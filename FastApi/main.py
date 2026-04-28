import os
import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
from qr_generator import encode_qr
from fastapi.responses import Response
from model import deleteProductCertificateRequest, addProductCertificateRequest, addProductInfoRequest, deleteProductInfoRequest, forSignResponse, sendUserOperationRequest, sendUserOperationResponse, EncodeRequest, EncodeResponse, changeStatusRequest, logPathHistoryRequest, logConditionRequest
from aa import deleteProductCertificateHash, addProductCertificateHash, deleteProductInfoHash, addProductInfoHash, estGas, sendUserOp, changeStatusHash, logPathHistoryHash, logConditionHash
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Web3: Verification and Account Abstraction API")
PINATA_JWT = os.getenv("PINATA_JWT")
PINATA_GATEWAY = os.getenv("PINATA_GATEWAY", "gateway.pinata.cloud")

print("JWT loaded:", bool(PINATA_JWT), "len:", len(PINATA_JWT or ""))

def handle_web3_errors(e: Exception):
    if isinstance(e, ValueError):
        raise HTTPException(status_code=400, detail=str(e))
    elif isinstance(e, requests.exceptions.RequestException):
        raise HTTPException(status_code=503, detail=f"RPC/Bundler connection error: {str(e)}")
    else:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
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

@app.get("/files/{cid}")
async def get_pdf(cid: str):
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(f"https://{PINATA_GATEWAY}/ipfs/{cid}")
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="File not found")
    return Response(content=resp.content, media_type="application/pdf")

@app.delete("/files/{file_id}")
async def delete_pdf(file_id: str):
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.delete(
            f"https://api.pinata.cloud/v3/files/public/{file_id}",
            headers={"Authorization": f"Bearer {PINATA_JWT}"},
        )
    if resp.status_code not in (200, 204):
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return {"deleted": file_id}

@app.get("/files/id-by-cid/{cid}")
async def get_id_by_cid(cid: str):
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

@app.post("/encode", response_model=EncodeResponse)
def encode(req: EncodeRequest):
    try:
        result = encode_qr(req.message)
        return result
    except Exception as e:
        handle_web3_errors(e)

@app.post("/sendUserOp", response_model=sendUserOperationResponse)
async def sendUserOperation(request: sendUserOperationRequest):
    try:
        opHash = sendUserOp(request.op)
        return {"opHash": opHash}
    except Exception as e:
        handle_web3_errors(e)

@app.post("/addProductInfo/estGas", response_model = forSignResponse)
async def estGasAddProductInfo(request: addProductInfoRequest):
    try:
        inner_data = addProductInfoHash(request.employee, request.name, request.serialNumber, request.origin, request.destination, request.mass, request.recipient)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handle_web3_errors(e)

@app.post("/deleteProductInfo/estGas", response_model = forSignResponse)
async def estGasDeleteProductInfo(request: deleteProductInfoRequest):
    try:
        inner_data = deleteProductInfoHash(request.employee, request.productId)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handle_web3_errors(e)

@app.post("/addProductCertificate/estGas", response_model = forSignResponse)
async def estGasAddProductCertificate(request: addProductCertificateRequest):
    try:
        inner_data = addProductCertificateHash(request.employee, request.productId, request.certificateURL)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handle_web3_errors(e)

@app.post("/deleteProductCertificate/estGas", response_model = forSignResponse)
async def estGasDeleteProductCertificate(request: deleteProductCertificateRequest):
    try:
        inner_data = deleteProductCertificateHash(request.employee, request.productId, request.index)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handle_web3_errors(e)

@app.post("/changeStatus/estGas", response_model = forSignResponse)
async def estGasChangeStatus(request: changeStatusRequest):
    try:
        inner_data = changeStatusHash(request.productId, request.manufacturerAddress)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handle_web3_errors(e)

@app.post("/logPathHistory/estGas", response_model = forSignResponse)
async def estGasLogPathHistory(request: logPathHistoryRequest):
    try:
        inner_data = logPathHistoryHash(request.productId, request.manufacturerAddress, request.to, request.location, request.note)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handle_web3_errors(e)

@app.post("/logCondition/estGas", response_model = forSignResponse)
async def estGasLogCondition(request: logConditionRequest):
    try:
        inner_data = logConditionHash(request.productId, request.manufacturerAddress, request.conditionType, request.value, request.unit)
        op, userHash = estGas(request.companyAccount, inner_data, request.employee)
        return {"op": op, "userHash": "0x" + userHash.hex()}
    except Exception as e:
        handle_web3_errors(e)



@app.get("/health")
def health():
    return {"status": "ok"}