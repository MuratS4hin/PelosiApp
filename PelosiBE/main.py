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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)