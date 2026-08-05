# scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from scraper import scrape_congress_trades
from utils.db_io import save_data_grouped
from services.stocks import fetch_all_ticker_data
from utils.test import scrape_insider_finance, save_to_postgres
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

def run_insider_scrape():
    try:
        rows = scrape_insider_finance()
        save_to_postgres(rows)
        logging.info(f"Insider scraper saved {len(rows)} records.")
    except Exception as e:
        logging.error(f"Insider scheduled task error: {e}")

def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        run_daily_scrape, 
        trigger='cron', 
        hour=12, 
        minute=0, 
        next_run_time=datetime.now() 
    )
    # Schedule insider_finance scraper separately (runs at 13:00 daily)
    scheduler.add_job(
        run_insider_scrape,
        trigger='cron',
        hour=13,
        minute=0,
        next_run_time=datetime.now()
    )
    scheduler.start()
    logging.info("Scheduler started.")
