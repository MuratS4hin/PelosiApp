from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from .db import get_db_connection, release_db_connection


def scrape_insider_finance():
    url = "https://www.insiderfinance.io/congress-trades"

    print("Launching browser to load dynamic content...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle")

        # Wait for the table to appear in the DOM
        page.wait_for_selector("table.w-full")
        html_content = page.content()
        browser.close()

    print("Parsing HTML...")
    soup = BeautifulSoup(html_content, "html.parser")
    table = soup.find("table", class_="w-full")

    if not table:
        print("Could not find the target table on the page.")
        return []

    trades_data = []
    rows = table.find("tbody").find_all("tr")

    for row in rows:
        politician_td = row.find("td", {"data-name": "Politician"})
        initials_div = politician_td.find("div", class_="rounded-sm")
        
        # Remove initials badge text from politician name
        politician = politician_td.get_text(strip=True)
        if initials_div:
            politician = politician.replace(initials_div.get_text(strip=True), "").strip()

        asset_cell = row.find("td", {"data-name": "Asset"})
        ticker_div = asset_cell.find("div", class_="rounded")
        asset_ticker = ticker_div.get_text(strip=True) if ticker_div else ""
        
        asset_name = asset_cell.find("span", title=True)
        asset_title = asset_name["title"] if asset_name else ""

        reported = row.find("td", {"data-name": "Reported"}).get_text(strip=True)
        traded = row.find("td", {"data-name": "Traded"}).get_text(strip=True)
        delay = row.find("td", {"data-name": "Delay"}).get_text(strip=True)
        buy_sell = row.find("td", {"data-name": "Buy/Sell"}).get_text(strip=True)

        amount_elem = row.find("td", {"data-name": "Amount"}).find("span", class_="text-gray-300")
        amount = amount_elem.get_text(strip=True) if amount_elem else ""

        owner = row.find("td", {"data-name": "Owner"}).get_text(strip=True)

        trades_data.append((
            politician,
            asset_ticker,
            asset_title,
            reported if reported else None,
            traded if traded else None,
            delay,
            buy_sell,
            amount,
            owner if owner else None
        ))

    return trades_data


def save_to_postgres(data):
    if not data:
        print("No data to save.")
        return

    conn = get_db_connection()
    cursor = conn.cursor()

    # Create table specific for this scraper
    create_table_query = """
    CREATE TABLE IF NOT EXISTS insider_finance_trades (
        id SERIAL PRIMARY KEY,
        politician VARCHAR(255),
        asset_ticker VARCHAR(50),
        asset_name VARCHAR(255),
        reported_date DATE,
        traded_date DATE,
        delay VARCHAR(50),
        buy_sell VARCHAR(50),
        amount VARCHAR(100),
        owner VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    cursor.execute(create_table_query)
    conn.commit()

    print(f"Inserting {len(data)} records into the database...")
    insert_query = """
    INSERT INTO insider_finance_trades
    (politician, asset_ticker, asset_name, reported_date, traded_date, delay, buy_sell, amount, owner)
    VALUES (%s, %s, %s, NULLIF(%s, '')::DATE, NULLIF(%s, '')::DATE, %s, %s, %s, NULLIF(%s, ''))
    """

    cursor.executemany(insert_query, data)
    conn.commit()

    cursor.close()
    release_db_connection(conn)
    print("Data successfully saved to DB via connection pool!")


#if __name__ == "__main__":
#    scraped_data = scrape_insider_finance()
#    save_to_postgres(scraped_data)