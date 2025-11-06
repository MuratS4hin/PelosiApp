import os
import json
from utils.grouping import group_by_purchase_date, merge_grouped_data

SAVE_DIR = "db"
GROUPED_JSON_PATH = os.path.join(SAVE_DIR, "congresstrades_grouped.json")
CONGRESSPEOPLE_PATH = os.path.join(SAVE_DIR, "congresspeople.json")
TICKERS_PATH = os.path.join(SAVE_DIR, "tickers.json")

def load_existing_grouped_data():
    if os.path.exists(GROUPED_JSON_PATH):
        with open(GROUPED_JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def load_congresspeople():
    if os.path.exists(CONGRESSPEOPLE_PATH):
        with open(CONGRESSPEOPLE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def load_tickers():
    if os.path.exists(TICKERS_PATH):
        with open(TICKERS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_data_grouped(rows):
    os.makedirs(SAVE_DIR, exist_ok=True)

    new_grouped = group_by_purchase_date(rows)
    existing_grouped = load_existing_grouped_data()
    merged = merge_grouped_data(existing_grouped, new_grouped)

    # Save main grouped data
    with open(GROUPED_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    # Extract names and tickers
    names_set = set()
    tickers_set = set()

    for date_rows in merged.values():
        for row in date_rows:
            if len(row) >= 3:
                # Politician name: take only the first part (before \n)
                full_name = row[2].split("\n")[0].strip()
                if full_name:
                    names_set.add(full_name)

                # Ticker: extract first code before newline or space
                ticker_line = row[0].strip()
                ticker = ticker_line.split("\n")[0].split()[0].strip()
                if ticker and ticker != "-":
                    tickers_set.add(ticker.upper())

    with open(CONGRESSPEOPLE_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted(names_set), f, ensure_ascii=False, indent=2)

    with open(TICKERS_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted(tickers_set), f, ensure_ascii=False, indent=2)
