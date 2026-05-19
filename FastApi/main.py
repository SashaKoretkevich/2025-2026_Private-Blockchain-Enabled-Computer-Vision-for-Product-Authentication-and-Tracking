import os, shutil, tempfile, base64, httpx, requests
from fastapi import FastAPI, File, HTTPException, UploadFile, Form
from pydantic import BaseModel
from fastapi.responses import Response
from model import deleteProductCertificateRequest, addProductCertificateRequest, addProductInfoRequest, deleteProductInfoRequest, forSignResponse, sendUserOperationRequest, sendUserOperationResponse, encodeRequest, encodeResponse, changeStatusRequest, logPathHistoryRequest, logConditionRequest, QRMessageRequest, QRMessageResponse, verifyResponse,  addProductPublicKeyRequest, verifyProductEventRequest
from web3Connection.aa import deleteProductCertificateHash, addProductCertificateHash, deleteProductInfoHash, addProductInfoHash, estGas, sendUserOp, changeStatusHash, logPathHistoryHash, logConditionHash, verifyProductEventHash, addProductPublicKeyHash
from web3Connection.secLayerMess import prepareMess, makeQR
from qr.verifySig import verifySignature
from qr.qrDecode import extract_signature
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Web3: Verification and Account Abstraction API")
PINATA_JWT = os.getenv("PINATA_JWT")
PINATA_GATEWAY = os.getenv("PINATA_GATEWAY", "gateway.pinata.cloud")

def handleErrors(e: Exception):
    if isinstance(e, HTTPException):
        raise e
    if isinstance(e, ValueError):
        raise HTTPException(status_code=400, detail=str(e))
    if isinstance(e, requests.exceptions.RequestException):
        raise HTTPException(status_code=503, detail=f"RPC/Bundler connection error: {str(e)}")
    raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/prepareQRMessage", response_model=QRMessageResponse)
def qrPrepare(req: QRMessageRequest):
    try:
        message = prepareMess(req.productId, req.manufacturerAddress)
        messageHex = "0x" + message.encode("utf-8").hex()
        return QRMessageResponse(messageHash=messageHex,)
    except Exception as e:
        handleErrors(e)
 
 
@app.post("/generateQR", response_model=encodeResponse)
def qrGenerate(req: encodeRequest):
    try:
        result = makeQR(req.productId, req.manufacturerAddress, req.signature)
        return encodeResponse(qr_image_base64 = base64.b64encode(result["qrPng"]).decode(), publicKeyCompressed = result["publicKeyCompressed"],)
    except Exception as e:
        handleErrors(e)

@app.post("/decodeAndVerifyQR", response_model=verifyResponse)
async def qrDecode(productId: int = Form(...), manufacturerAddress: str = Form(..., min_length=42, max_length=42), file: UploadFile = File(...),):
    tmp_path = None
    try:
        suffix = os.path.splitext(file.filename or "")[1] or ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        await file.close()

        sigHex = extract_signature(tmp_path)
        sigBytes = bytes.fromhex(sigHex)

        is_valid = verifySignature(sigBytes, productId, manufacturerAddress)
        return verifyResponse(isValid=is_valid)

    except Exception as e:
        handleErrors(e)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    
@app.post("/uploadCertificate")
async def uploadCertificate(file: UploadFile = File(...)):
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://uploads.pinata.cloud/v3/files",
                headers={"Authorization": f"Bearer {PINATA_JWT}"},
                files={"file": (file.filename, await file.read(), "application/pdf")},
                data={"network": "public"},
            )
        resp.raise_for_status()
        cid = resp.json()["data"]["cid"]
        return {"cid": cid, "url": f"https://{PINATA_GATEWAY}/ipfs/{cid}"}
    except Exception as e:
        handleErrors(e)

@app.get("/certificate/{cid}")
async def getCertificate(cid: str):
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(f"https://{PINATA_GATEWAY}/ipfs/{cid}")
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="File not found")
        return Response(content=resp.content, media_type="application/pdf")
    except Exception as e:
        handleErrors(e)

@app.delete("/certificate/{file_id}")
async def deleteCertificate(file_id: str):
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.delete(f"https://api.pinata.cloud/v3/files/public/{file_id}", headers={"Authorization": f"Bearer {PINATA_JWT}"},)
        if resp.status_code not in (200, 204):
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return {"deleted": file_id}
    except Exception as e:
        handleErrors(e)

@app.get("/certificate/id-by-cid/{cid}")
async def getIdByCid(cid: str):
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(
                "https://api.pinata.cloud/v3/files/public",
                headers={"Authorization": f"Bearer {PINATA_JWT}"},
                params={"cid": cid},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        files = resp.json()["data"]["files"]
        if not files:
            raise HTTPException(status_code=404, detail="No file found for this CID")
        return {"id": files[0]["id"], "cid": cid, "name": files[0].get("name")}
    except Exception as e:
        handleErrors(e)

@app.post("/sendUserOp", response_model=sendUserOperationResponse)
async def sendUserOperation(request: sendUserOperationRequest):
    try:
        opHash = sendUserOp(request.op)
        return {"opHash": opHash}
    except Exception as e:
        handleErrors(e)

@app.post("/addProductInfo/estGas", response_model = forSignResponse)
async def estGasAddProductInfo(request: addProductInfoRequest):
    try:
        inner_data = addProductInfoHash(request.employee, request.name, request.serialNumber, request.origin, request.destination, request.mass, request.recipient)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handleErrors(e)

@app.post("/deleteProductInfo/estGas", response_model = forSignResponse)
async def estGasDeleteProductInfo(request: deleteProductInfoRequest):
    try:
        inner_data = deleteProductInfoHash(request.employee, request.productId)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handleErrors(e)

@app.post("/addProductCertificate/estGas", response_model = forSignResponse)
async def estGasAddProductCertificate(request: addProductCertificateRequest):
    try:
        inner_data = addProductCertificateHash(request.employee, request.productId, request.certificateURL)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handleErrors(e)

@app.post("/deleteProductCertificate/estGas", response_model = forSignResponse)
async def estGasDeleteProductCertificate(request: deleteProductCertificateRequest):
    try:
        inner_data = deleteProductCertificateHash(request.employee, request.productId, request.index)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handleErrors(e)

@app.post("/changeStatus/estGas", response_model = forSignResponse)
async def estGasChangeStatus(request: changeStatusRequest):
    try:
        inner_data = changeStatusHash(request.productId, request.manufacturerAddress)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handleErrors(e)

@app.post("/logPathHistory/estGas", response_model = forSignResponse)
async def estGasLogPathHistory(request: logPathHistoryRequest):
    try:
        inner_data = logPathHistoryHash(request.productId, request.manufacturerAddress, request.to, request.location, request.note)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handleErrors(e)

@app.post("/logCondition/estGas", response_model = forSignResponse)
async def estGasLogCondition(request: logConditionRequest):
    try:
        inner_data = logConditionHash(request.productId, request.manufacturerAddress, request.conditionType, request.value, request.unit)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handleErrors(e)

@app.post("/addProductPublicKey/estGas", response_model = forSignResponse)
async def estGasAddProductPublicKey(request: addProductPublicKeyRequest):
    try:
        inner_data = addProductPublicKeyHash(request.employee, request.productId,request.publicKeyCompressed)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handleErrors(e)

@app.post("/verifyProductEvent/estGas", response_model = forSignResponse)
async def estGasVerifyProductEvent(request: verifyProductEventRequest):
    try:
        inner_data = verifyProductEventHash(request.productId, request.manufacturerAddress, request.isValid)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handleErrors(e)

@app.get("/health")
def health():
    return {"status": "ok"}