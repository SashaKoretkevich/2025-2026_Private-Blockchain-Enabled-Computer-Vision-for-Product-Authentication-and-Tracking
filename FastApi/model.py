from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

class addProductInfoRequest(BaseModel):
    companyAccount: str = Field(..., length=42, description="Address of manufacturer's smart account")
    employee: str = Field(..., length=42, description="Wallet address employee")
    name: str = Field(..., description="Product name")
    serialNumber: str = Field(..., description="Serial number")
    origin: str = Field(..., description="Origin")
    destination: str = Field(..., description="Destination")
    mass: int = Field(..., description="Product mass")
    recipient: str = Field(..., length=42, description="Wallet address recipient")

class deleteProductInfoRequest(BaseModel):
    companyAccount: str = Field(..., length=42, description="Address of manufacturer's smart account")
    employee: str = Field(..., length=42, description="Wallet address employee")
    productId: int = Field(..., description="ID of the product to delete")

class addProductCertificateRequest(BaseModel):
    companyAccount: str = Field(..., length=42, description="Address of manufacturer's smart account")
    employee: str = Field(..., length=42, description="Wallet address employee")
    productId: int = Field(..., description="ID of the product to add certificate for")
    certificateURL: str = Field(..., description="URL of the product certificate")

class deleteProductCertificateRequest(BaseModel):
    companyAccount: str = Field(..., length=42, description="Address of manufacturer's smart account")
    employee: str = Field(..., length=42, description="Wallet address employee")
    productId: int = Field(..., description="ID of the product to delete certificate from")
    index: int = Field(..., description="Index of the certificate to delete")

class changeStatusRequest(BaseModel):
    companyAccount: str = Field(..., length=42, description="Address of manufacturer's smart account")
    employee: str = Field(..., length=42, description="Wallet address employee")
    productId: int = Field(..., description="ID of the product to change status for")
    manufacturerAddress: str = Field(..., length=42, description="Address of the manufacturer")

class logPathHistoryRequest(BaseModel):
    companyAccount: str = Field(..., length=42, description="Address of smart account")
    employee: str = Field(..., length=42, description="Wallet address employee")
    productId: int = Field(..., description="ID of the product to log path history for")
    manufacturerAddress: str = Field(..., length=42, description="Address of the manufacturer")
    to: str = Field(..., length=42, description="Wallet address next holder")
    location: str = Field(..., description="Location of the product")
    note: str = Field(..., description="Additional note")

class logConditionRequest(BaseModel):
    companyAccount: str = Field(..., length=42, description="Address of smart account")
    employee: str = Field(..., length=42, description="Wallet address employee")
    productId: int = Field(..., description="ID of the product to log condition for")
    manufacturerAddress: str = Field(..., length=42, description="Address of the manufacturer")
    conditionType: str = Field(..., description="Type of the condition (e.g. temperature, humidity)")
    value: int = Field(..., description="Value of the condition")
    unit: str = Field(..., description="Unit of the condition (e.g. °C, %)")

class forSignResponse(BaseModel):
    op: dict
    userHash: str

class sendUserOperationRequest(BaseModel):
    op: dict
    
class sendUserOperationResponse(BaseModel):
    opHash: str

class EncodeRequest(BaseModel):
    message: str

class EncodeResponse(BaseModel):
    qr_image_base64: str   
    public_key_pem: str 
    signature_hex: str
    message: str
