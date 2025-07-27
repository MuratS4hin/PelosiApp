import os
import json
import csv
import random 
from datetime import datetime, timedelta
from fastapi import FastAPI
from collections import defaultdict
from playwright.sync_api import sync_playwright
import uvicorn
import yfinance as yf

app = FastAPI()

SAVE_DIR = "db"
GROUPED_JSON_PATH = os.path.join(SAVE_DIR, "congresstrades_grouped.json")


def scrape_congress_trades():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        page.goto("https://www.quiverquant.com/congresstrading/", timeout=90000)
        page.wait_for_selector("div.table-inner tbody tr", timeout=60000)

        rows = page.query_selector_all("div.table-inner tbody tr")
        data = []
        for r in rows:
            cells = r.query_selector_all("td")
            cell_text = [c.inner_text().strip() for c in cells]
            if cell_text:  # skip empty rows
                data.append(cell_text)

        browser.close()
        return data


def group_by_purchase_date(rows):
    grouped = defaultdict(list)
    for row in rows:
        if len(row) < 5:
            continue
        purchase_date = row[3]  # "Jul. 24, 2025"
        grouped[purchase_date].append(row)
    return grouped


def load_existing_grouped_data():
    if os.path.exists(GROUPED_JSON_PATH):
        with open(GROUPED_JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def merge_grouped_data(existing, new):
    for date, new_rows in new.items():
        if date not in existing:
            existing[date] = new_rows
        else:
            # Create set of existing keys for deduplication
            existing_keys = {f"{r[0]}|{r[2]}|{r[3]}" for r in existing[date]}
            for row in new_rows:
                if len(row) < 4:
                    continue
                key = f"{row[0]}|{row[2]}|{row[3]}"
                if key not in existing_keys:
                    existing[date].append(row)
                    existing_keys.add(key)
    return existing


def save_data_grouped(rows):
    os.makedirs(SAVE_DIR, exist_ok=True)

    new_grouped = group_by_purchase_date(rows)
    existing_grouped = load_existing_grouped_data()
    merged_grouped = merge_grouped_data(existing_grouped, new_grouped)

    with open(GROUPED_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(merged_grouped, f, ensure_ascii=False, indent=2)


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


@app.get("/congresstrades/grouped")
def get_grouped_data():
    return load_existing_grouped_data()


@app.get("/stockinfo/{ticker}")
def get_stock_info(ticker: str):
    try:
        stock = yf.Ticker(ticker.upper())
        info = stock.info

        # Get basic current data
        company_name = info.get("longName", "N/A")
        current_price = info.get("currentPrice", 0.0)
        previous_close = info.get("previousClose", 0.0)

        change = round(current_price - previous_close, 2)
        percent_change = round((change / previous_close) * 100, 2) if previous_close else 0

        # Get last 7 days of historical data
        history = stock.history(period="7d")
        chart_data = [
            {"date": idx.strftime('%Y-%m-%d'), "close": round(row["Close"], 2)}
            for idx, row in history.iterrows()
        ]

        return {
            "ticker": ticker.upper(),
            "company_name": company_name,
            "current_price": current_price,
            "change": change,
            "percent_change": percent_change,
            "chart": chart_data
        }

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000)