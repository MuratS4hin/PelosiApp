"""
Security utilities for API authentication.
"""
from fastapi import HTTPException, status
from typing import Optional
import os
from functools import wraps

# You can set this as an environment variable or hardcode for development
API_PASSWORD = os.getenv("API_PASSWORD", "secret_key")


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
