"""Token encryption utilities."""

import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from .config import get_settings

settings = get_settings()


def get_fernet() -> Fernet:
    """Get Fernet instance for encryption/decryption."""
    # Derive a proper key from the encryption key
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"intellibooks-oauth-salt",  # In production, use a proper salt
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(settings.encryption_key.encode()))
    return Fernet(key)


def encrypt_token(token: str) -> str:
    """Encrypt a token for storage."""
    if not token:
        return ""
    fernet = get_fernet()
    return fernet.encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a token from storage."""
    if not encrypted_token:
        return ""
    fernet = get_fernet()
    return fernet.decrypt(encrypted_token.encode()).decode()
