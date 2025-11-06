from fastapi import FastAPI
from scraper import scrape_congress_trades
from services.scheduler import start_scheduler
from utils.file_io import save_data_grouped, load_existing_grouped_data, load_congresspeople, load_tickers
from services.stocks import get_stock_info
from datetime import datetime
import uvicorn

app = FastAPI()
start_scheduler() 

@app.get("/")
def root():
    return {"message": "Congress Trade Scraper API running."}

@app.get("/congresstrades")
def get_trades():
    try:
        rows = scrape_congress_trades()
        save_data_grouped(rows)
        return {"message": "Scraped and saved.", "count": len(rows)}
    except Exception as e:
        return {"error": str(e)}

@app.get("/stocks/{ticker}")
def stock_data(ticker: str, start: str, end: str):
    return get_stock_info(ticker, start, end)

@app.get("/stocks/fetch-all")
def fetch_all_stocks(start: str, end: str):
    return fetch_all_ticker_data(start, end)

@app.get("/congresstrades/grouped")
def get_grouped_data():
    return load_existing_grouped_data()

@app.get("/congresstrades/congresspeople")
def get_congresspeople():
    return load_congresspeople()

@app.get("/congresstrades/tickers")
def get_tickers():
    return load_tickers()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
