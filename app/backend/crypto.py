"""Cryptographic identity — RSA key pair generation and event signing."""

import base64
import hashlib
import json
import os

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

KEYS_DIR = os.environ.get("KEYS_DIR", "/data/keys")


def _key_path(name: str) -> str:
    os.makedirs(KEYS_DIR, exist_ok=True)
    return os.path.join(KEYS_DIR, name)


def generate_keypair() -> tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]:
    """Generate a new RSA-2048 key pair and persist to disk."""
    priv_path = _key_path("node.key")
    pub_path = _key_path("node.pub")

    if os.path.exists(priv_path):
        priv_key = serialization.load_pem_private_key(
            open(priv_path, "rb").read(), password=None
        )
        return priv_key, priv_key.public_key()

    priv_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with open(priv_path, "wb") as f:
        f.write(priv_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ))
    with open(pub_path, "wb") as f:
        f.write(priv_key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        ))

    return priv_key, priv_key.public_key()


def get_public_key_pem() -> str:
    """Return this node's public key as PEM string."""
    pub_path = _key_path("node.pub")
    return open(pub_path).read()


def sign_event(priv_key: rsa.RSAPrivateKey, event: dict) -> str:
    """Sign the canonical form of an event dict. Returns base64-encoded signature."""
    payload = _canonical(event)
    sig = priv_key.sign(payload, padding.PKCS1v15(), hashes.SHA256())
    return base64.b64encode(sig).decode()


def verify_signature(pub_key_pem: str, event: dict, signature_b64: str) -> bool:
    """Verify an event signature against a PEM public key."""
    pub_key = serialization.load_pem_public_key(pub_key_pem.encode())
    payload = _canonical(event)
    sig = base64.b64decode(signature_b64)
    try:
        pub_key.verify(sig, payload, padding.PKCS1v15(), hashes.SHA256())
        return True
    except Exception:
        return False


def _canonical(event: dict) -> bytes:
    """Deterministic serialization of event fields for signing."""
    fields = {k: event[k] for k in sorted(event) if k not in ("signature", "hops")}
    return json.dumps(fields, sort_keys=True, separators=(",", ":")).encode()
