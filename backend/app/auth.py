from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

SECRET_KEY = "dev-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = timedelta(minutes=30)
REFRESH_TOKEN_EXPIRE = timedelta(days=7)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRE
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def create_refresh_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + REFRESH_TOKEN_EXPIRE
    return jwt.encode(
        {"sub": str(user_id), "exp": expire, "type": "refresh"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
