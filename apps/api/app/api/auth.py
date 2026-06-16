from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.project import User
from app.schemas.architecture import AuthRequest, AuthUser
from app.services.auth import (
    SESSION_COOKIE_DOMAIN,
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_SAMESITE,
    SESSION_COOKIE_SECURE,
    SESSION_TTL_SECONDS,
    create_session_token,
    hash_password,
    parse_session_token,
    verify_password,
)

router = APIRouter()


def _set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=create_session_token(user_id),
        httponly=True,
        samesite=SESSION_COOKIE_SAMESITE,
        secure=SESSION_COOKIE_SECURE,
        domain=SESSION_COOKIE_DOMAIN,
        max_age=SESSION_TTL_SECONDS,
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        samesite=SESSION_COOKIE_SAMESITE,
        secure=SESSION_COOKIE_SECURE,
        domain=SESSION_COOKIE_DOMAIN,
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = parse_session_token(request.cookies.get(SESSION_COOKIE_NAME))
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None

    try:
        user_id = parse_session_token(token)
    except HTTPException:
        return None

    return db.query(User).filter(User.id == user_id).first()


@router.post("/register", response_model=AuthUser)
def register(payload: AuthRequest, response: Response, db: Session = Depends(get_db)) -> AuthUser:
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    _set_session_cookie(response, user.id)
    return AuthUser(id=user.id, email=user.email, createdAt=user.created_at)


@router.post("/login", response_model=AuthUser)
def login(payload: AuthRequest, response: Response, db: Session = Depends(get_db)) -> AuthUser:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    _set_session_cookie(response, user.id)
    return AuthUser(id=user.id, email=user.email, createdAt=user.created_at)


@router.get("/me", response_model=AuthUser)
def me(user: User = Depends(get_current_user)) -> AuthUser:
    return AuthUser(id=user.id, email=user.email, createdAt=user.created_at)


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    _clear_session_cookie(response)
    return {"status": "ok"}
