import qrcode
import numpy as np
from PIL import Image
import hashlib, base64, io
import ecdsa
from bitarray import bitarray
import reedsolo

QR_VERSION = 4
QR_SIZE = 33
QUIET_ZONE = 4
MODULE_SIZE = 5
CROSS_MASK = np.array([
    [0,0,0,0,0],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[0,0,0,0,0]
], dtype=int)

def generate_base_qr(message):
    qr = qrcode.QRCode(version=QR_VERSION,
                       error_correction=qrcode.constants.ERROR_CORRECT_H,
                       box_size=10, border=0)
    qr.add_data(message)
    qr.make(fit=True)
    matrix = np.array(qr.get_matrix(), dtype=int)
    h, w = matrix.shape
    full = np.zeros((h + 2*QUIET_ZONE, w + 2*QUIET_ZONE), dtype=int)
    full[QUIET_ZONE:QUIET_ZONE+h, QUIET_ZONE:QUIET_ZONE+w] = matrix
    return full

def identify_functional_patterns(matrix):
    h, w = matrix.shape
    f = np.zeros_like(matrix, dtype=bool)
    f[:QUIET_ZONE,:] = f[-QUIET_ZONE:,:] = f[:,:QUIET_ZONE] = f[:,-QUIET_ZONE:] = True
    for i in range(7):
        for j in range(7):
            f[QUIET_ZONE+i][QUIET_ZONE+j] = True
            f[QUIET_ZONE+i][w-QUIET_ZONE-7+j] = True
            f[h-QUIET_ZONE-7+i][QUIET_ZONE+j] = True
    for i in range(8):
        f[QUIET_ZONE+i][QUIET_ZONE+7] = True
        f[QUIET_ZONE+7][QUIET_ZONE+i] = True
    for i in range(8, w-8):
        f[QUIET_ZONE+6][QUIET_ZONE+i] = True
    for i in range(8, h-8):
        f[QUIET_ZONE+i][QUIET_ZONE+6] = True
    for i in range(9):
        f[QUIET_ZONE+8][QUIET_ZONE+i] = True
        f[QUIET_ZONE+i][QUIET_ZONE+8] = True
    return f

def get_data_modules(functional_mask):
    h, w = functional_mask.shape
    return [(y, x) for y in range(h) for x in range(w) if not functional_mask[y][x]]

def encode_qr(message: str) -> dict:

    private_key = ecdsa.SigningKey.generate(curve=ecdsa.SECP256k1)
    public_key = private_key.get_verifying_key()

    msg_hash = hashlib.sha256(message.encode()).digest()
    signature = private_key.sign(msg_hash)

    base = generate_base_qr(message)
    functional = identify_functional_patterns(base)
    data_modules = get_data_modules(functional)

    sig_bits = len(signature) * 8
    target_bits = min(len(data_modules), int(sig_bits * 1.3))
    target_bytes = target_bits // 8
    ec_bytes = target_bytes - len(signature)
    if ec_bytes > 0:
        rs = reedsolo.RSCodec(ec_bytes)
        sig_with_red = bytes(rs.encode(signature))
    else:
        sig_with_red = signature
    if len(sig_with_red) * 8 > target_bits:
        sig_with_red = sig_with_red[:target_bytes]

    h, w = base.shape
    sig_layer = np.zeros((h, w), dtype=int)
    bits = bitarray()
    bits.frombytes(sig_with_red)
    if len(bits) > len(data_modules):
        bits = bits[:len(data_modules)]
    for i, (y, x) in enumerate(data_modules):
        if i < len(bits):
            sig_layer[y][x] = bits[i]

    result = Image.new('L', (w * MODULE_SIZE, h * MODULE_SIZE), 255)
    pixels = result.load()
    for y in range(h):
        for x in range(w):
            base_bit = base[y][x]
            sig_bit = sig_layer[y][x]
            for dy in range(MODULE_SIZE):
                for dx in range(MODULE_SIZE):
                    px, py = x * MODULE_SIZE + dx, y * MODULE_SIZE + dy
                    if sig_bit == 0:
                        pixels[px, py] = 0 if base_bit == 1 else 255
                    else:
                        if CROSS_MASK[dy][dx] == 1:
                            pixels[px, py] = 0 if base_bit == 0 else 255
                        else:
                            pixels[px, py] = 0 if base_bit == 1 else 255


    buf = io.BytesIO()
    result.convert('RGB').save(buf, format='PNG')
    img_b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "qr_image_base64": img_b64,
        "public_key_pem": public_key.to_pem().decode(),
        "signature_hex": signature.hex(),
        "message": message
    }