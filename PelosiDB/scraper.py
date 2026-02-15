from playwright.sync_api import sync_playwright

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
        data = [[c.inner_text().strip() for c in r.query_selector_all("td")] for r in rows]
        
        browser.close()
        print(f"Scraped {len(data)} rows of data.")
        return [row for row in data if row]
