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
    """
    Verify if the provided password matches the API password.
    
    Args:
        provided_password: The password provided in the request
        
    Returns:
        True if password is correct, False otherwise
    """
    return provided_password == API_PASSWORD


def check_api_security(password: Optional[str] = None) -> None:
    """
    Check API security by verifying the provided password.
    Use this as a dependency in FastAPI routes.
    
    Args:
        password: The password to verify
        
    Raises:
        HTTPException: If password is missing or incorrect
    """
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
    """
    Decorator to require authentication for a function.
    Used for protecting functions that are called internally.
    
    Args:
        func: The function to protect
        
    Returns:
        Wrapped function that requires password
    """
    @wraps(func)
    def wrapper(*args, password: Optional[str] = None, **kwargs):
        check_api_security(password)
        return func(*args, **kwargs)
    return wrapper
