from datetime import datetime
import json
import os
import requests
import yfinance as yf
from utils.db_io import load_tickers


def _safe_company_name(stock, ticker: str):
    try:
        info = stock.info or {}
        name = info.get("longName") or info.get("shortName")
        if isinstance(name, str) and name.strip():
            return name.strip()
    except Exception:
        pass
    return ticker.upper()


def _build_chart(history):
    return [
        {"date": idx.strftime("%Y-%m-%d"), "close": round(float(row["Close"]), 2)}
        for idx, row in history.iterrows()
        if row.get("Close") is not None
    ]


def _compute_change(chart):
    if len(chart) >= 2:
        first, last = chart[0]["close"], chart[-1]["close"]
        change = round(last - first, 2)
        percent = round((change / first) * 100, 2) if first else 0
        return change, percent
    return 0.0, 0.0


def _fetch_finnhub_quote(ticker: str):
    try:
        api_key = os.getenv("FINNHUB_API_KEY")
        if not api_key:
            return None

        url = "https://finnhub.io/api/v1/quote"
        resp = requests.get(
            url,
            params={"symbol": ticker.upper(), "token": api_key},
            timeout=12,
        )
        if not resp.ok:
            return None

        data = resp.json() if "application/json" in resp.headers.get("Content-Type", "") else None
        if not isinstance(data, dict):
            return None

        current = data.get("c")
        prev_close = data.get("pc")
        high = data.get("h")
        low = data.get("l")

        if current in (None, 0):
            return None

        return {
            "current": round(float(current), 2),
            "previous_close": round(float(prev_close), 2) if prev_close not in (None, 0) else None,
            "high": round(float(high), 2) if high not in (None, 0) else None,
            "low": round(float(low), 2) if low not in (None, 0) else None,
        }
    except Exception:
        return None

def get_stock_info(ticker: str, start: str, end: str):
    try:
        start_date = datetime.strptime(start, "%Y-%m-%d")
        end_date = datetime.strptime(end, "%Y-%m-%d")
        if start_date >= end_date:
            return {"error": "Start date must be before end date."}

        stock = yf.Ticker(ticker.upper())
        company_name = _safe_company_name(stock, ticker)

        history = stock.history(start=start_date, end=end_date)
        chart = _build_chart(history)
        change, percent = _compute_change(chart)

        last_price = chart[-1]["close"] if chart else None
        first_price = chart[0]["close"] if chart else None
        high_price = max([point["close"] for point in chart], default=None)
        low_price = min([point["close"] for point in chart], default=None)
        avg_price = round(sum([point["close"] for point in chart]) / len(chart), 2) if chart else None

        if last_price is None:
            try:
                fast_info = stock.fast_info or {}
                if fast_info.get("lastPrice") is not None:
                    last_price = round(float(fast_info.get("lastPrice")), 2)
                if fast_info.get("previousClose") is not None and first_price is None:
                    first_price = round(float(fast_info.get("previousClose")), 2)
            except Exception:
                pass

        if last_price is None:
            quote = _fetch_finnhub_quote(ticker)
            if quote:
                last_price = quote.get("current")
                if first_price is None:
                    first_price = quote.get("previous_close")
                if high_price is None:
                    high_price = quote.get("high")
                if low_price is None:
                    low_price = quote.get("low")
                if avg_price is None and high_price is not None and low_price is not None:
                    avg_price = round((high_price + low_price) / 2, 2)

                if (not chart) and first_price not in (None, 0):
                    change = round(last_price - first_price, 2)
                    percent = round((change / first_price) * 100, 2)

        if high_price is None and chart:
            high_price = max([point["close"] for point in chart], default=None)
        if low_price is None and chart:
            low_price = min([point["close"] for point in chart], default=None)
        if avg_price is None and chart:
            avg_price = round(sum([point["close"] for point in chart]) / len(chart), 2)

        return {
            "ticker": ticker.upper(),
            "company_name": company_name,
            "first_price": first_price,
            "last_price": last_price,
            "high_price": high_price,
            "low_price": low_price,
            "avg_price": avg_price,
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
            try:
                stock = yf.Ticker(ticker.upper())
                company_name = _safe_company_name(stock, ticker)
                history = stock.history(start=start_date, end=end_date)
                chart = _build_chart(history)
                change, percent = _compute_change(chart)

                last_price = chart[-1]["close"] if chart else None
                first_price = chart[0]["close"] if chart else None

                if last_price is None:
                    try:
                        fast_info = stock.fast_info or {}
                        if fast_info.get("lastPrice") is not None:
                            last_price = round(float(fast_info.get("lastPrice")), 2)
                        if fast_info.get("previousClose") is not None and first_price is None:
                            first_price = round(float(fast_info.get("previousClose")), 2)
                    except Exception:
                        pass

                result[ticker.upper()] = {
                    "company_name": company_name,
                    "first_price": first_price,
                    "last_price": last_price,
                    "change": change,
                    "percent_change": percent,
                    "chart": chart,
                }
            except Exception as inner_error:
                result[ticker.upper()] = {
                    "company_name": ticker.upper(),
                    "first_price": None,
                    "last_price": None,
                    "change": 0.0,
                    "percent_change": 0.0,
                    "chart": [],
                    "error": str(inner_error),
                }

        # Save to JSON
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)

        return {"message": "Stock data fetched and saved.", "count": len(result)}

    except Exception as e:
        return {"error": str(e)}


def get_recommendation_trends(ticker: str):
    try:
        api_key = os.getenv("FINNHUB_API_KEY")
        if not api_key:
            return {"error": "FINNHUB_API_KEY not set"}

        url = "https://finnhub.io/api/v1/stock/recommendation"
        resp = requests.get(url, params={"symbol": ticker.upper(), "token": api_key}, timeout=15)
        if not resp.ok:
            return {"error": f"Finnhub request failed: {resp.status_code}", "detail": resp.text}

        content_type = resp.headers.get("Content-Type", "")
        if "application/json" not in content_type:
            return {"error": "Unexpected Finnhub response", "detail": resp.text}

        return resp.json()

    except Exception as e:
        return {"error": str(e)}


def get_company_news(ticker: str, start: str, end: str):
    try:
        api_key = os.getenv("FINNHUB_API_KEY")
        if not api_key:
            return {"error": "FINNHUB_API_KEY not set"}

        url = "https://finnhub.io/api/v1/company-news"
        resp = requests.get(
            url,
            params={"symbol": ticker.upper(), "from": start, "to": end, "token": api_key},
            timeout=15,
        )
        if not resp.ok:
            return {"error": f"Finnhub request failed: {resp.status_code}", "detail": resp.text}

        return resp.json()

    except Exception as e:
        return {"error": str(e)}
