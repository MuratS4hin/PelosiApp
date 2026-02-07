from datetime import datetime
import yfinance as yf
from utils.db_io import load_tickers

def get_stock_info(ticker: str, start: str, end: str):
    try:
        start_date = datetime.strptime(start, "%Y-%m-%d")
        end_date = datetime.strptime(end, "%Y-%m-%d")
        if start_date >= end_date:
            return {"error": "Start date must be before end date."}

        stock = yf.Ticker(ticker.upper())
        info = stock.info
        company_name = info.get("longName", "N/A")
        history = stock.history(start=start_date, end=end_date)

        chart = [
            {"date": idx.strftime("%Y-%m-%d"), "close": round(row["Close"], 2)}
            for idx, row in history.iterrows()
        ]

        if len(chart) >= 2:
            first, last = chart[0]["close"], chart[-1]["close"]
            change = round(last - first, 2)
            percent = round((change / first) * 100, 2) if first else 0
        else:
            change = percent = 0.0

        return {
            "ticker": ticker.upper(),
            "company_name": company_name,
            "first_price": chart[0]["close"] if chart else None,
            "last_price": chart[-1]["close"] if chart else None,
            "change": change,
            "percent_change": percent,
            "chart": chart,
        }

    except Exception as e:
        return {"error": str(e)}

def fetch_all_ticker_data(start: str = None, end: str = None, output_path="data/stock_data.json"):
    try:
        if start is None or end is None:
            end = datetime.today().strftime("%Y-%m-%d")
            start = "1900-01-01"  # string format

        # now safe to parse these strings:
        start_date = datetime.strptime(start, "%Y-%m-%d")
        end_date = datetime.strptime(end, "%Y-%m-%d")
        if start_date >= end_date:
            raise ValueError("Start date must be before end date.")

        tickers = load_tickers()
        result = {}

        for ticker in tickers:
            stock = yf.Ticker(ticker.upper())
            info = stock.info
            company_name = info.get("longName", "N/A")
            history = stock.history(start=start_date, end=end_date)

            chart = [
                {"date": idx.strftime("%Y-%m-%d"), "close": round(row["Close"], 2)}
                for idx, row in history.iterrows()
            ]

            if len(chart) >= 2:
                first, last = chart[0]["close"], chart[-1]["close"]
                change = round(last - first, 2)
                percent = round((change / first) * 100, 2) if first else 0
            else:
                change = percent = 0.0

            result[ticker.upper()] = {
                "company_name": company_name,
                "first_price": chart[0]["close"] if chart else None,
                "last_price": chart[-1]["close"] if chart else None,
                "change": change,
                "percent_change": percent,
                "chart": chart,
            }

        # Save to JSON
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)

        return {"message": "Stock data fetched and saved.", "count": len(result)}

    except Exception as e:
        return {"error": str(e)}
