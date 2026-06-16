from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from typing import Optional

from fastapi import HTTPException
from app.config import settings

SESSION_COOKIE_NAME = settings.session_cookie_name
SESSION_SECRET = settings.session_secret
SESSION_COOKIE_SECURE = settings.session_cookie_secure
SESSION_COOKIE_SAMESITE = settings.session_cookie_samesite
SESSION_COOKIE_DOMAIN = settings.session_cookie_domain
SESSION_TTL_SECONDS = settings.session_ttl_seconds


def hash_password(password: str, salt: Optional[str] = None) -> str:
    password_salt = salt or secrets.token_hex(16)
    digest = hashlib.sha256(f"{password_salt}:{password}".encode("utf-8")).hexdigest()
    return f"{password_salt}${digest}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, expected = password_hash.split("$", 1)
    except ValueError:
        return False
    actual = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return secrets.compare_digest(actual, expected)


def create_session_token(user_id: int) -> str:
    payload = str(user_id).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("utf-8")
    signature = hmac.new(SESSION_SECRET.encode("utf-8"), encoded.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def parse_session_token(token: Optional[str]) -> int:
    if not token or "." not in token:
        raise HTTPException(status_code=401, detail="Authentication required")

    encoded, signature = token.split(".", 1)
    expected = hmac.new(SESSION_SECRET.encode("utf-8"), encoded.encode("utf-8"), hashlib.sha256).hexdigest()
    if not secrets.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid session")

    try:
        payload = base64.urlsafe_b64decode(encoded.encode("utf-8")).decode("utf-8")
        return int(payload)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=401, detail="Invalid session") from None
