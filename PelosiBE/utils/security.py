"""
Security utilities for API authentication and JWT.
"""
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os
from functools import wraps
from datetime import datetime, timedelta
import jwt

# You can set this as an environment variable or hardcode for development
API_PASSWORD = os.getenv("API_PASSWORD", "secret_key")
JWT_SECRET = os.getenv("JWT_SECRET", API_PASSWORD)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

auth_scheme = HTTPBearer()


def verify_password(provided_password: str) -> bool:
    return provided_password == API_PASSWORD


def check_api_security(password: Optional[str] = None) -> None:
    if password is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(password):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid password",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_auth(func):
    @wraps(func)
    def wrapper(*args, password: Optional[str] = None, **kwargs):
        check_api_security(password)
        return func(*args, **kwargs)
    return wrapper


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
) -> int:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return int(user_id)
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
