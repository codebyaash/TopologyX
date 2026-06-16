from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _list_env(name: str, default: list[str]) -> list[str]:
    value = os.getenv(name)
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: list[str]
    session_secret: str
    session_cookie_name: str
    session_cookie_secure: bool
    session_cookie_samesite: str
    session_cookie_domain: str | None
    session_ttl_seconds: int


settings = Settings(
    database_url=os.getenv("DATABASE_URL", "sqlite:///./architecture_copilot.db"),
    cors_origins=_list_env("CORS_ORIGINS", ["http://localhost:3000", "http://127.0.0.1:3000"]),
    session_secret=os.getenv("SESSION_SECRET", "dev-session-secret"),
    session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "architecture_session"),
    session_cookie_secure=_bool_env("SESSION_COOKIE_SECURE", False),
    session_cookie_samesite=os.getenv("SESSION_COOKIE_SAMESITE", "lax"),
    session_cookie_domain=os.getenv("SESSION_COOKIE_DOMAIN"),
    session_ttl_seconds=_int_env("SESSION_TTL_SECONDS", 60 * 60 * 24 * 14),
)
