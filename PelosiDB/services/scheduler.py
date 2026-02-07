# scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from scraper import scrape_congress_trades
from utils.db_io import save_data_grouped
from services.stocks import fetch_all_ticker_data
from datetime import datetime  # Import datetime to trigger immediate run
import logging

def run_daily_scrape():
    try:
        rows = scrape_congress_trades()
        save_data_grouped(rows)
        fetch_all_ticker_data()
        logging.info(f"Scraped and saved {len(rows)} trades.")
    except Exception as e:
        logging.error(f"Scheduled task error: {e}")

def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        run_daily_scrape, 
        trigger='cron', 
        hour=12, 
        minute=0, 
        next_run_time=datetime.now() 
    )
    scheduler.start()
    logging.info("Scheduler started.")
