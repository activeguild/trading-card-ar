import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db_models import User
from app.deps import get_db

router = APIRouter(prefix="/api/auth")

REFRESH_MAX_AGE = 7 * 24 * 3600  # 7 days


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _set_refresh_cookie(response: Response, user_id: int) -> None:
    token = create_refresh_token(user_id)
    response.set_cookie(
        "refresh_token",
        token,
        httponly=True,
        samesite="lax",
        max_age=REFRESH_MAX_AGE,
    )


@router.post("/register", response_model=TokenResponse)
def register(
    req: AuthRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=req.email, password_hash=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_refresh_cookie(response, user.id)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(
    req: AuthRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _set_refresh_cookie(response, user.id)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = int(payload["sub"])
    except (pyjwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    _set_refresh_cookie(response, user.id)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"ok": True}
