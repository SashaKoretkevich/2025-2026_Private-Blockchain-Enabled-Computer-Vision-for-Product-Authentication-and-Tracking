import qrcode
import numpy as np
import csv
from PIL import Image, ImageDraw, ImageFont
import hashlib
import ecdsa
from bitarray import bitarray
import reedsolo
import os
import io
from eth_utils import to_checksum_address
import base64

QR_VERSION = 4
QR_SIZE    = 33 
QUIET_ZONE = 4
TOTAL_SIZE = QR_SIZE + 2 * QUIET_ZONE  

EC_LEVEL = qrcode.constants.ERROR_CORRECT_H
ID = 8


SIZES = [5, 10, 15]  

MASKS_5 = {
    "cross": np.array([          
        [0,0,0,0,0],
        [0,1,0,1,0],
        [0,0,1,0,0],
        [0,1,0,1,0],
        [0,0,0,0,0]
    ], dtype=int),

    "corner": np.array([         
        [0,0,0,0,0],
        [0,1,0,0,0],
        [0,1,0,0,0],
        [0,1,1,1,0],
        [0,0,0,0,0]
    ], dtype=int),

    "triangle": np.array([      
        [0,0,0,0,0],
        [0,1,0,0,0],
        [0,1,1,0,0],
        [0,1,1,1,0],
        [0,0,0,0,0]
    ], dtype=int),

    "square": np.array([         
        [0,0,0,0,0],
        [0,1,1,0,0],
        [0,1,1,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0]
    ], dtype=int),
}


def scale_mask(mask_5x5, module_size):
    factor = module_size // 5
    return np.kron(mask_5x5, np.ones((factor, factor), dtype=int))



def generate_base_qr(message):
    qr = qrcode.QRCode(
        version=QR_VERSION,
        error_correction=EC_LEVEL,
        box_size=10,
        border=0,
    )
    qr.add_data(message)
    qr.make(fit=False)

    matrix = np.array(qr.get_matrix(), dtype=int)

    h, w = matrix.shape
    full_matrix = np.zeros((h + 2*QUIET_ZONE, w + 2*QUIET_ZONE), dtype=int)
    full_matrix[QUIET_ZONE:QUIET_ZONE+h, QUIET_ZONE:QUIET_ZONE+w] = matrix

    return full_matrix


def identify_functional_patterns(matrix):
    h, w = matrix.shape
    functional = np.zeros_like(matrix, dtype=bool)

    functional[:QUIET_ZONE, :]  = True
    functional[-QUIET_ZONE:, :] = True
    functional[:, :QUIET_ZONE]  = True
    functional[:, -QUIET_ZONE:] = True

    for i in range(7):
        for j in range(7):
            functional[QUIET_ZONE+i][QUIET_ZONE+j]             = True
            functional[QUIET_ZONE+i][w-QUIET_ZONE-7+j]         = True
            functional[h-QUIET_ZONE-7+i][QUIET_ZONE+j]         = True

    for i in range(8):
        if QUIET_ZONE+7 < w: functional[QUIET_ZONE+i][QUIET_ZONE+7] = True
        if QUIET_ZONE+7 < h: functional[QUIET_ZONE+7][QUIET_ZONE+i] = True

    for i in range(8, w-8):
        if QUIET_ZONE+6 < h and QUIET_ZONE+i < w:
            functional[QUIET_ZONE+6][QUIET_ZONE+i] = True
    for i in range(8, h-8):
        if QUIET_ZONE+i < h and QUIET_ZONE+6 < w:
            functional[QUIET_ZONE+i][QUIET_ZONE+6] = True

    for i in range(9):
        if QUIET_ZONE+8 < h and QUIET_ZONE+i < w:
            functional[QUIET_ZONE+8][QUIET_ZONE+i] = True
        if QUIET_ZONE+i < h and QUIET_ZONE+8 < w:
            functional[QUIET_ZONE+i][QUIET_ZONE+8] = True

    return functional


def get_data_modules(functional_mask):
    modules = []
    h, w = functional_mask.shape
    for y in range(h):
        for x in range(w):
            if not functional_mask[y][x]:
                modules.append((y, x))
    return modules


def generate_signature(message):
    if os.path.exists('private_key.pem'):
        with open('private_key.pem', 'rb') as f:
            private_key = ecdsa.SigningKey.from_pem(f.read())
    else:
        private_key = ecdsa.SigningKey.generate(curve=ecdsa.SECP256k1)
        public_key = private_key.get_verifying_key()
        with open('private_key.pem', 'wb') as f: f.write(private_key.to_pem())
        with open('public_key.pem',  'wb') as f: f.write(public_key.to_pem())

    msg_hash  = hashlib.sha256(message.encode()).digest()
    signature = private_key.sign_digest_deterministic(
        msg_hash, hashfunc=hashlib.sha256
    )
    print(type(signature))
    return signature


def add_redundancy(signature, available_bits):
    sig_bits     = len(signature) * 8
    target_bits  = min(available_bits, int(sig_bits * 1.3))
    target_bytes = target_bits // 8


    ec_bytes = target_bytes - len(signature)
    if ec_bytes > 0:
        rs      = reedsolo.RSCodec(ec_bytes)
        encoded = bytes(rs.encode(signature))
    else:
        encoded = signature

    if len(encoded) * 8 > target_bits:
        encoded = encoded[:target_bytes]
    return encoded


def create_signature_layer(base, functional, signature_data):
    h, w      = base.shape
    sig_layer = np.zeros((h, w), dtype=int)

    data_modules = get_data_modules(functional)
    sig_bits     = bitarray()
    sig_bits.frombytes(signature_data)

    if len(sig_bits) > len(data_modules):
        print(f"⚠️ Truncating to {len(data_modules)} bits")
        sig_bits = sig_bits[:len(data_modules)]

    for i, (y, x) in enumerate(data_modules):
        if i < len(sig_bits):
            sig_layer[y][x] = sig_bits[i]

    bits_written = min(len(sig_bits), len(data_modules))

    return sig_layer


def render_final_qr(base, signature, scale, style_mask):
    h, w   = base.shape
    result = Image.new('L', (w*scale, h*scale), 255)
    pixels = result.load()
    result_matrix = np.zeros((h*scale, w*scale), dtype=int)

    for y in range(h):
        for x in range(w):
            base_bit = base[y][x]
            sig_bit  = signature[y][x]

            for dy in range(scale):
                for dx in range(scale):
                    px, py = x*scale+dx, y*scale+dy

                    if sig_bit == 0:
                        pixel_value = 0 if base_bit == 1 else 255
                    else:
                        if style_mask[dy][dx] == 1:
                            pixel_value = 0 if base_bit == 0 else 255
                        else:
                            pixel_value = 0 if base_bit == 1 else 255

                    pixels[px, py] = pixel_value
                    result_matrix[py][px] = 1 if pixel_value == 0 else 0

    return result.convert('RGB'), result_matrix


def save_all_files(final_img, style_name, module_size):
    final_img.save(f'qr_final_{style_name}_s{module_size}.png')


def generateDualQR (productId: int, manufacturerAddress: str, signature: bytes):
    if len(signature) != 65:
        raise ValueError(f"Expected 65-byte signature, got {len(signature)}")
    
    addr_bytes = bytes.fromhex(manufacturerAddress[2:])
    addr_b64 = base64.b64encode(addr_bytes).decode()

    MESSAGE  = str(productId) + ":" + addr_b64
    base = generate_base_qr(MESSAGE)
    functional   = identify_functional_patterns(base)
    data_modules = get_data_modules(functional)
    count_dm = len(data_modules)

    sig_with_red = add_redundancy(signature, count_dm)
    sig_layer = create_signature_layer(base, functional, sig_with_red)


    saved_paths = []

    module_size = SIZES[2]
    mask = MASKS_5["square"]

    scaled_mask = scale_mask(mask, module_size)
    final_qr, final_matrix = render_final_qr(base, sig_layer, module_size, scaled_mask)
    buf = io.BytesIO()
    final_qr.save(buf, format="PNG")
    save_all_files(final_qr, "square", module_size)
    saved_paths.append(f'qr_final_{"square"}_s{module_size}.png')
    return buf.getvalue()


