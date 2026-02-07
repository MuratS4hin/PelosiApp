from fastapi import FastAPI, Body
from services.scheduler import start_scheduler
from utils.db_io import save_data_grouped, load_congresspeople, load_tickers, find_same_politician_same_stock_type
from services.stocks import get_stock_info, fetch_all_ticker_data  # Added fetch_all_ticker_data
from utils.db import init_db
import uvicorn

app = FastAPI()

# --- STARTUP LOGIC ---
@app.on_event("startup")
def on_startup():
    init_db()         # 1. Prepare Database Tables
    start_scheduler()  # 2. Start the background tasks ONLY once here

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)