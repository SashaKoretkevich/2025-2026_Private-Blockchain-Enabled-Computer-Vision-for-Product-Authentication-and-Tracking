import io
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
import main

COMPANY_ADDR_DUMMY  = "0x1111111111111111111111111111111111111111"
EMPLOYEE_ADDR_DUMMY = "0x2222222222222222222222222222222222222222"
RECIPIENT_ADDR_DUMMY = "0x3333333333333333333333333333333333333333"
SIGNATURE_DUMMY = "0x" + "1b" * 65
PUBLIC_KEY_COMPRESSED_DUMMY = "02" + "ab" * 32


def mock_http(method: str, *, status: int = 200, json_data: dict | None = None, content: bytes = b""):
    response = MagicMock(status_code=status, content=content, text="")
    response.json.return_value = json_data or {}
    client = MagicMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    setattr(client, method, AsyncMock(return_value=response))
    return client


@pytest.fixture
def client():
    return TestClient(main.app)


# Test /health endpoint

def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


# Test /prepareQRMessage endpoint

def test_prepare_qr_message_success(client):
    mocked = "Aircraft"
    with patch.object(main, "prepareMess", return_value=mocked):
        res = client.post("/prepareQRMessage", json={"productId": 1, "manufacturerAddress": COMPANY_ADDR_DUMMY})
    mockedHex = mocked.encode().hex()
    assert res.status_code == 200
    assert res.json()["messageHash"] == "0x" + mockedHex

def test_prepare_qr_message_missing_field(client):
    assert client.post("/prepareQRMessage", json={"productId": 1}).status_code == 422

def test_prepare_qr_message_error(client):
    with patch.object(main, "prepareMess", side_effect=ValueError("Error message")):
        res = client.post("/prepareQRMessage", json={"productId": 1, "manufacturerAddress": COMPANY_ADDR_DUMMY})
    assert res.status_code == 400
    assert res.json()["detail"] == "Error message"


# Test /generateQR endpoint

def test_generate_qr(client):
    mocked = {"qrPng": b"\x89PNG", "publicKeyCompressed": PUBLIC_KEY_COMPRESSED_DUMMY}
    with patch.object(main, "makeQR", return_value=mocked):
        res = client.post("/generateQR", json={"productId": 1, "manufacturerAddress": COMPANY_ADDR_DUMMY, "signature": SIGNATURE_DUMMY})
    assert res.status_code == 200
    assert res.json()["publicKeyCompressed"] == PUBLIC_KEY_COMPRESSED_DUMMY


# Test /decodeAndVerifyQR endpoint

def test_qr_decode_verify_success(client):
    with patch.object(main, "extract_signature", return_value="ab" * 65), \
         patch.object(main, "verifySignature", return_value=True):
        res = client.post("/decodeAndVerifyQR", data={"productId": "1", "manufacturerAddress": COMPANY_ADDR_DUMMY}, files={"file": ("qr.png", io.BytesIO(b"fake-png"), "image/png")})
    assert res.status_code == 200
    assert res.json() == {"isValid": True}

def test_qr_decode_verify_invalid(client):
    with patch.object(main, "extract_signature", return_value="ab" * 65), \
         patch.object(main, "verifySignature", return_value=False):
        res = client.post("/decodeAndVerifyQR", data={"productId": "1", "manufacturerAddress": COMPANY_ADDR_DUMMY}, files={"file": ("qr.png", io.BytesIO(b"fake-png"), "image/png")})
    assert res.status_code == 200
    assert res.json() == {"isValid": False}

def test_qr_decode_verify_error_400(client):
    with patch.object(main, "extract_signature", side_effect=ValueError("Error message")):
        res = client.post("/decodeAndVerifyQR", data={"productId": "1", "manufacturerAddress": COMPANY_ADDR_DUMMY}, files={"file": ("qr.png", io.BytesIO(b"x"), "image/png")})
    assert res.status_code == 400
    assert res.json()["detail"] == "Error message"


# Test /uploadCertificate endpoint

def test_upload_certificate(client):
    http = mock_http("post", json_data={"data": {"cid": "abcd"}})
    with patch.object(main.httpx, "AsyncClient", return_value=http):
        res = client.post("/uploadCertificate", files={"file": ("c.pdf", io.BytesIO(b"%PDF"), "application/pdf")})
    assert res.status_code == 200
    assert res.json()["cid"] == "abcd"


# Test /certificate/{cid} endpoint

def test_get_certificate_success(client):
    http = mock_http("get", content=b"%PDF-fake")
    with patch.object(main.httpx, "AsyncClient", return_value=http):
        res = client.get("/certificate/QmABC")
    assert res.status_code == 200
    assert res.content == b"%PDF-fake"

def test_get_certificate_error_404(client):
    http = mock_http("get", status=404)
    with patch.object(main.httpx, "AsyncClient", return_value=http):
        assert client.get("/certificate/abcd").status_code == 404


# Test /certificate/{file_id} endpoint

def test_delete_certificate(client):
    http = mock_http("delete")
    with patch.object(main.httpx, "AsyncClient", return_value=http):
        assert client.delete("/certificate/1").json() == {"deleted": "1"}


# Test /certificate/id-by-cid/{cid} endpoint

def test_id_by_cid_found(client):
    http = mock_http("get", json_data={"data": {"files": [{"id": "1", "name": "cert.pdf"}]}})
    with patch.object(main.httpx, "AsyncClient", return_value=http):
        res = client.get("/certificate/id-by-cid/abcd")
    assert res.json()["id"] == "1"

def test_id_by_cid_not_found(client):
    http = mock_http("get", json_data={"data": {"files": []}})
    with patch.object(main.httpx, "AsyncClient", return_value=http):
        assert client.get("/certificate/id-by-cid/abcd").status_code == 404


# Test /sendUserOp endpoint

def test_send_user_op_success(client):
    with patch.object(main, "sendUserOp", return_value="0xkadskjsdjdna"):
        assert client.post("/sendUserOp", json={"op": {"sender": COMPANY_ADDR_DUMMY}}).json() == {"opHash": "0xkadskjsdjdna"}

def test_send_user_op_error_400(client):
    with patch.object(main, "sendUserOp", side_effect=ValueError("fail")):
        res = client.post("/sendUserOp", json={"op": {"sender": COMPANY_ADDR_DUMMY}})
    assert res.status_code == 400
    assert res.json()["detail"] == "fail"


# Test /addProductInfo/estGas endpoint

def test_add_product_info(client):
    with patch.object(main, "estGas", return_value=({"sender": COMPANY_ADDR_DUMMY}, b"\xab" * 32)), \
         patch.object(main, "addProductInfoHash", return_value = bytes("inner_data", "utf-8")):
        res = client.post("/addProductInfo/estGas", json={
            "companyAccount": COMPANY_ADDR_DUMMY, "employee": EMPLOYEE_ADDR_DUMMY,
            "name": "Widget", "serialNumber": "SN",
            "origin": "A", "destination": "B", "mass": 1, "recipient": RECIPIENT_ADDR_DUMMY,})
    assert res.status_code == 200
    assert res.json()["op"]["sender"] == COMPANY_ADDR_DUMMY
    assert res.json()["userHash"].startswith("0x")


# Test /deleteProductInfo/estGas endpoint

def test_delete_product_info(client):
    with patch.object(main, "estGas", return_value=({"sender": COMPANY_ADDR_DUMMY}, b"\xab" * 32)), \
         patch.object(main, "deleteProductInfoHash", return_value = bytes("inner_data", "utf-8")):
        res = client.post("/deleteProductInfo/estGas", json={"companyAccount": COMPANY_ADDR_DUMMY,
        "employee": EMPLOYEE_ADDR_DUMMY, "productId": 1,})
    assert res.status_code == 200
    assert res.json()["op"]["sender"] == COMPANY_ADDR_DUMMY
    assert res.json()["userHash"].startswith("0x")


# Test /addProductCertificate/estGas endpoint

def test_add_product_certificate(client):
    with patch.object(main, "estGas", return_value=({"sender": COMPANY_ADDR_DUMMY}, b"\xab" * 32)), \
         patch.object(main, "addProductCertificateHash", return_value = bytes("inner_data", "utf-8")):
        res = client.post("/addProductCertificate/estGas", json={
            "companyAccount": COMPANY_ADDR_DUMMY, "employee": EMPLOYEE_ADDR_DUMMY,
            "productId": 1, "certificateURL": "abcdfghj",})
    assert res.status_code == 200
    assert res.json()["op"]["sender"] == COMPANY_ADDR_DUMMY
    assert res.json()["userHash"].startswith("0x")


# Test /deleteProductCertificate/estGas endpoint

def test_delete_product_certificate(client):
    with patch.object(main, "estGas", return_value=({"sender": COMPANY_ADDR_DUMMY}, b"\xab" * 32)), \
         patch.object(main, "deleteProductCertificateHash", return_value = bytes("inner_data", "utf-8")):
        res = client.post("/deleteProductCertificate/estGas", json={
            "companyAccount": COMPANY_ADDR_DUMMY, "employee": EMPLOYEE_ADDR_DUMMY,
            "productId": 1, "index": 0,})
    assert res.status_code == 200
    assert res.json()["op"]["sender"] == COMPANY_ADDR_DUMMY
    assert res.json()["userHash"].startswith("0x")


# Test /changeStatus/estGas endpoint

def test_change_status(client):
    with patch.object(main, "estGas", return_value=({"sender": COMPANY_ADDR_DUMMY}, b"\xab" * 32)), \
         patch.object(main, "changeStatusHash", return_value = bytes("inner_data", "utf-8")):
        res = client.post("/changeStatus/estGas", json={"companyAccount": COMPANY_ADDR_DUMMY, 
            "employee": EMPLOYEE_ADDR_DUMMY,"productId": 1, 
            "manufacturerAddress": COMPANY_ADDR_DUMMY,})
    assert res.status_code == 200
    assert res.json()["op"]["sender"] == COMPANY_ADDR_DUMMY
    assert res.json()["userHash"].startswith("0x")


# Test /logPathHistory/estGas endpoint

def test_log_path_history(client):
    with patch.object(main, "estGas", return_value=({"sender": COMPANY_ADDR_DUMMY}, b"\xab" * 32)), \
         patch.object(main, "logPathHistoryHash", return_value = bytes("inner_data", "utf-8")):
        res = client.post("/logPathHistory/estGas", json={"companyAccount": COMPANY_ADDR_DUMMY, "employee": EMPLOYEE_ADDR_DUMMY,
            "productId": 1, "manufacturerAddress": COMPANY_ADDR_DUMMY,
            "to": RECIPIENT_ADDR_DUMMY, "location": "London", "note": "ok",})
    assert res.status_code == 200
    assert res.json()["op"]["sender"] == COMPANY_ADDR_DUMMY
    assert res.json()["userHash"].startswith("0x")


# Test /logCondition/estGas endpoint

def test_log_condition(client):
    with patch.object(main, "estGas", return_value=({"sender": COMPANY_ADDR_DUMMY}, b"\xab" * 32)), \
         patch.object(main, "logConditionHash", return_value = bytes("inner_data", "utf-8")):
        res= client.post("/logCondition/estGas", json={"companyAccount": COMPANY_ADDR_DUMMY, "employee": EMPLOYEE_ADDR_DUMMY,
            "productId": 1, "manufacturerAddress": COMPANY_ADDR_DUMMY,
            "conditionType": "temp", "value": -5, "unit": "C",})
    assert res.status_code == 200
    assert res.json()["op"]["sender"] == COMPANY_ADDR_DUMMY
    assert res.json()["userHash"].startswith("0x")


# Test /addProductPublicKey/estGas endpoint

def test_add_product_public_key(client):
    with patch.object(main, "estGas", return_value=({"sender": COMPANY_ADDR_DUMMY}, b"\xab" * 32)), \
         patch.object(main, "addProductPublicKeyHash", return_value=b"inner"):
        res = client.post("/addProductPublicKey/estGas", json={"companyAccount": COMPANY_ADDR_DUMMY, "employee": EMPLOYEE_ADDR_DUMMY,
            "productId": 1, "publicKeyCompressed": PUBLIC_KEY_COMPRESSED_DUMMY,})
    assert res.status_code == 200
    assert res.json()["op"]["sender"] == COMPANY_ADDR_DUMMY
    assert res.json()["userHash"].startswith("0x")


# Test /verifyProductEvent/estGas endpoint

def test_verify_product_event(client):
    with patch.object(main, "estGas", return_value=({"sender": COMPANY_ADDR_DUMMY}, b"\xab" * 32)), \
         patch.object(main, "verifyProductEventHash", return_value = bytes("inner_data", "utf-8")):
        res = client.post("/verifyProductEvent/estGas", json={"companyAccount": COMPANY_ADDR_DUMMY, "employee": EMPLOYEE_ADDR_DUMMY,
            "productId": 1, "manufacturerAddress": COMPANY_ADDR_DUMMY, "isValid": True,})
    assert res.status_code == 200
    assert res.json()["op"]["sender"] == COMPANY_ADDR_DUMMY
    assert res.json()["userHash"].startswith("0x")


# Test estGas error handling

def test_est_gas_error_400(client):
    with patch.object(main, "deleteProductInfoHash", return_value=b"inner"), \
         patch.object(main, "estGas", side_effect=ValueError("bad")):
        res = client.post("/deleteProductInfo/estGas", json={"companyAccount": COMPANY_ADDR_DUMMY, "employee": EMPLOYEE_ADDR_DUMMY, "productId": 1,})
    assert res.status_code == 400
    assert res.json()["detail"] == "bad"
