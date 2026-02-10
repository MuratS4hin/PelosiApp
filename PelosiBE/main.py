from fastapi import FastAPI, Body, Query
#from scraper import scrape_congress_trades
#from services.scheduler import start_scheduler
from utils.db_io import load_congresspeople, load_tickers, find_same_politician_same_stock_type, load_existing_data
from services.stocks import get_stock_info, fetch_all_ticker_data, get_recommendation_trends, get_company_news  # Added fetch_all_ticker_data
from utils.db import init_db
from utils.security import check_api_security
from typing import Optional
from dotenv import load_dotenv
import uvicorn

app = FastAPI()

load_dotenv()

@app.on_event("startup")
def startup_event():
    init_db()

# --- ROUTES ---
@app.get("/")
def root():
    return {"message": "Congress Trade Scraper API running."}

# @app.get("/congresstrades")
# def get_trades():
#     try:
#         rows = scrape_congress_trades()
#         save_data_grouped(rows)
#         return {"message": "Scraped and saved.", "count": len(rows)}
#     except Exception as e:
#         return {"error": str(e)}

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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)