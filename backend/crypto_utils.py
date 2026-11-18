import hashlib, json, base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives import serialization

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def canonical_bytes(manifest: dict) -> bytes:
    # Stable representation: UTF-8 JSON, sorted keys, compact separators.
    return json.dumps(manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def generate_keypair():
    private = Ed25519PrivateKey.generate()
    private_pem = private.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem

def sign(private_pem: bytes, manifest: dict) -> str:
    private = serialization.load_pem_private_key(private_pem, password=None)
    signature = private.sign(canonical_bytes(manifest))
    return base64.b64encode(signature).decode("ascii")

def verify_signature(public_pem: str, manifest: dict, signature_b64: str) -> bool:
    try:
        public = serialization.load_pem_public_key(public_pem.encode("utf-8"))
        signature = base64.b64decode(signature_b64, validate=True)
        public.verify(signature, canonical_bytes(manifest))
        return True
    except Exception:
        return False
