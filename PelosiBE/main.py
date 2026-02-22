from fastapi import FastAPI, Body, Query, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
import bcrypt
from utils.db_io import (
    load_congresspeople,
    load_tickers,
    find_same_politician_same_stock_type,
    load_existing_data,
    create_user,
    get_user_by_email,
    get_user_by_id,
    add_favorite_stock,
    list_favorite_stocks,
    remove_favorite_stock,
    delete_user,
    request_password_reset,
    verify_reset_token,
    reset_password,
)
from services.stocks import get_stock_info, fetch_all_ticker_data, get_recommendation_trends, get_company_news  # Added fetch_all_ticker_data
from utils.db import init_db
from utils.security import check_api_security, create_access_token, get_current_user_id
from typing import Optional
from dotenv import load_dotenv
import uvicorn

app = FastAPI()

load_dotenv()




class AuthPayload(BaseModel):
    email: EmailStr
    password: str


class FavoritePayload(BaseModel):
    ticker: str


class PasswordResetRequestPayload(BaseModel):
    email: EmailStr


class PasswordResetPayload(BaseModel):
    token: str
    new_password: str


class VerifyResetCodePayload(BaseModel):
    code: str

@app.on_event("startup")
def startup_event():
    init_db()

# --- ROUTES ---
@app.get("/")
def root():
    return {"message": "Congress Trade Scraper API running."}

@app.get("/stocks/{ticker}")
def stock_data(ticker: str, start: str, end: str, password: Optional[str] = Query(None)):
    check_api_security(password)
    return get_stock_info(ticker, start, end)

@app.get("/stocks/fetch-all")
def fetch_all_stocks(start: str, end: str, password: Optional[str] = Query(None)):
    check_api_security(password)
    return fetch_all_ticker_data(start, end)

@app.get("/stocks/recommendation-trends/{ticker}")
def recommendation_trends(ticker: str, password: Optional[str] = Query(None)):
    check_api_security(password)
    return get_recommendation_trends(ticker)

@app.get("/stocks/company-news/{ticker}")
def company_news(ticker: str, start: str, end: str, password: Optional[str] = Query(None)):
    check_api_security(password)
    return get_company_news(ticker, start, end)

@app.get("/congresstrades/congresspeople")
def get_congresspeople(password: Optional[str] = Query(None)):
    check_api_security(password)
    return load_congresspeople()

@app.get("/congresstrades/tickers")
def get_tickers(password: Optional[str] = Query(None)):
    check_api_security(password)
    return load_tickers()

@app.get("/congresstrades/load_existing_data")
def get_grouped_data(password: Optional[str] = Query(None)):
    check_api_security(password)
    return load_existing_data()

@app.post("/congresstrades/find_same_politician_same_stock_type")
def api_get_same(trades: list[dict] = Body(...), password: Optional[str] = Query(None)):
    check_api_security(password)
    results = []
    for t in trades:
        res = find_same_politician_same_stock_type(
            ticker=t.get("ticker"),
            politician=t.get("politician")
        )
        results.extend(res)
    return results


@app.post("/auth/register")
def register(payload: AuthPayload):
    password_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = create_user(payload.email, password_hash)
    if not user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    token = create_access_token(user["id"])
    return {"token": token, "user": user}


@app.post("/auth/login")
def login(payload: AuthPayload):
    user = get_user_by_email(payload.email)
    if not user or not bcrypt.checkpw(payload.password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "created_at": user["created_at"]}}


@app.get("/me")
def me(user_id: int = Depends(get_current_user_id)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@app.get("/favorites")
def get_favorites(user_id: int = Depends(get_current_user_id)):
    return list_favorite_stocks(user_id)


@app.post("/favorites")
def add_favorite(payload: FavoritePayload, user_id: int = Depends(get_current_user_id)):
    created = add_favorite_stock(user_id, payload.ticker)
    if not created:
        return {"message": "Already in favorites"}
    return created


@app.delete("/favorites/{ticker}")
def delete_favorite(ticker: str, user_id: int = Depends(get_current_user_id)):
    removed = remove_favorite_stock(user_id, ticker)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")
    return {"message": "Removed"}


@app.delete("/auth/account")
def delete_account(user_id: int = Depends(get_current_user_id)):
    """Delete the authenticated user's account and all associated data."""
    deleted = delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"message": "Account deleted successfully"}


@app.post("/auth/request-password-reset")
def request_password_reset_endpoint(payload: PasswordResetRequestPayload):
    """Send a password reset code to the user via email."""
    success = request_password_reset(payload.email)
    if not success:
        # For security, don't reveal if email exists
        pass
    return {"message": "If an account exists with that email, a password reset code will be sent."}


@app.post("/auth/verify-reset-code")
def verify_reset_code_endpoint(payload: VerifyResetCodePayload):
    """Verify the password reset code and return a temporary token."""
    user = verify_reset_token(payload.code)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code")
    return {"message": "Code verified successfully", "user_id": user["id"]}


@app.post("/auth/reset-password")
def reset_password_endpoint(payload: PasswordResetPayload):
    """Reset the user's password using a valid reset token."""
    success = reset_password(payload.token, bcrypt.hashpw(payload.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"))
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    return {"message": "Password reset successfully"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)