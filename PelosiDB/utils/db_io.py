import json
import logging
from datetime import datetime
from psycopg2.extras import Json 
from .db import get_db_connection, release_db_connection

def parse_date(date_str):
    try:
        clean_date = date_str.replace(".", "")
        return datetime.strptime(clean_date, "%b %d, %Y").date()
    except:
        return None

def extract_company_name(stock_string):
    """
    Extract the company name from the stock string.
    Example input: "NFLX\nNETFLIX, INC. - COMMON STOCK\nST"
    Expected output: "NETFLIX"
    
    Args:
        stock_string: The raw stock field containing ticker, company name, and type
        
    Returns:
        Extracted company name (first word before comma or dash)
    """
    try:
        parts = stock_string.split("\n")
        if len(parts) < 2:
            return ""
        
        # Get the second line which contains company name
        company_line = parts[1].strip()
        
        # Extract the company name (first word or text before comma/dash)
        # "NETFLIX, INC. - COMMON STOCK" -> "NETFLIX"
        company_name = company_line.split(",")[0].strip()
        
        # If still too long, try splitting by dash
        if len(company_name) > 20:
            company_name = company_name.split(" - ")[0].strip()
        
        print(company_name)

        return company_name
    except:
        return ""

def save_data_grouped(rows):
    conn = get_db_connection()
    cur = conn.cursor()
    
    for row in rows:
        # SAFETY CHECK: Skip rows that don't have all 7 expected columns
        if not row or len(row) < 7:
            continue
            
        try:
            # 1. Save to Raw Table - Use Json() adapter to avoid formatting issues
            cur.execute(
                "INSERT INTO trades_raw (raw_content) VALUES (%s)", 
                [Json(row)] # Using a list [] instead of a tuple () for clarity
            )
            
            # 2. Extract Congressman
            name_parts = row[2].split("\n")
            name = name_parts[0].strip()
            chamber_party = name_parts[1].split("/") if len(name_parts) > 1 else ["Unknown", "Unknown"]
            chamber = chamber_party[0].strip()
            party = chamber_party[1].strip() if len(chamber_party) > 1 else ""

            cur.execute("""
                INSERT INTO congressmen (name, chamber, party) 
                VALUES (%s, %s, %s) ON CONFLICT (name) DO UPDATE SET chamber=EXCLUDED.chamber 
                RETURNING id
            """, (name, chamber, party))
            congressman_id = cur.fetchone()[0]

            # 3. Extract Stock
            ticker_raw = row[0].split("\n")[0].strip()
            company_name = extract_company_name(row[0])
            full_company_description = row[0].split("\n")[1].strip() if len(row[0].split("\n")) > 1 else ""
            
            # If ticker is "-" (common in your JSON), use the company description instead
            if ticker_raw == "-" and "Company:" in row[5]:
                ticker_raw = row[5].split(":")[1].split("(")[0].strip()[:10]
            elif ticker_raw == "-":
                company_name = row[0].split("\n")[1].strip()
            
            cur.execute("""
                INSERT INTO stocks (ticker, company_name, name) 
                VALUES (%s, %s, %s) 
                ON CONFLICT (ticker) DO UPDATE SET 
                    company_name=COALESCE(NULLIF(EXCLUDED.company_name, ''), stocks.company_name),
                    name=COALESCE(NULLIF(EXCLUDED.name, ''), stocks.name)
                RETURNING id
            """, (ticker_raw, full_company_description, company_name))
            
            stock_res = cur.fetchone()
            stock_id = stock_res[0] if stock_res else None
            
            if not stock_id:
                cur.execute("SELECT id FROM stocks WHERE ticker = %s", (ticker_raw,))
                stock_id = cur.fetchone()[0]

            # 4. Save Transaction
            trans_parts = row[1].split("\n")
            trans_type = trans_parts[0].strip()
            amount = trans_parts[1].strip() if len(trans_parts) > 1 else ""
            trans_date = parse_date(row[4]) 

            if trans_date and stock_id:
                cur.execute("""
                    INSERT INTO transactions (congressman_id, stock_id, transaction_type, transaction_date, amount_range)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (congressman_id, stock_id, trans_type, trans_date, amount))

        except Exception as e:
            # Log the exact error and which row caused it
            print(f"Error processing row {row[2] if len(row)>2 else 'Unknown'}: {e}")
            conn.rollback()
            continue

    conn.commit()
    cur.close()
    release_db_connection(conn)

def load_congresspeople():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT politician FROM trades ORDER BY politician;")
    results = [r[0] for r in cur.fetchall()]
    cur.close()
    release_db_connection(conn)
    return results

def load_tickers():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT ticker FROM trades ORDER BY ticker;")
    results = [r[0] for r in cur.fetchall()]
    cur.close()
    release_db_connection(conn)
    return results

def find_same_politician_same_stock_type(ticker=None, politician=None):
    conn = get_db_connection()
    cur = conn.cursor()
    
    # This SQL finds entries where the politician and stock type (from raw text) match
    # It replaces that complex triple-nested loop you had
    query = """
        SELECT t1.purchase_date, t1.politician, t1.raw_ticker_text, t1.raw_politician_text, t2.raw_ticker_text
        FROM trades t1
        JOIN trades t2 ON t1.politician = t2.politician 
            AND right(t1.raw_ticker_text, 2) = right(t2.raw_ticker_text, 2)
            AND t1.id < t2.id
        WHERE 1=1
    """
    params = []
    if ticker:
        query += " AND t1.ticker = %s"
        params.append(ticker.upper())
    if politician:
        query += " AND t1.politician ILIKE %s"
        params.append(f"%{politician}%")

    cur.execute(query, params)
    rows = cur.fetchall()
    cur.close()
    release_db_connection(conn)
    
    return [{"date": r[0], "politician": r[1], "match": r} for r in rows]