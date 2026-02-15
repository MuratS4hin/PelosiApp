import json
import logging
from datetime import datetime
import psycopg2
from psycopg2.extras import Json 
from .db import get_db_connection, release_db_connection

def parse_date(date_str):
    try:
        clean_date = date_str.replace(".", "")
        return datetime.strptime(clean_date, "%b %d, %Y").date()
    except:
        return None

def load_congresspeople():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT id, name FROM congressmen ORDER BY name;")
    results = [(r[0], r[1]) for r in cur.fetchall()]
    cur.close()
    release_db_connection(conn)
    return results

def load_tickers():
    print("Loading tickers from DB...")
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT ticker FROM stocks ORDER BY ticker;")
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

def load_existing_data():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    s.ticker, c.name, t.transaction_date, t.transaction_type, s.name as ticker_name
                FROM stocks s
                LEFT JOIN (
                    SELECT *,
                        ROW_NUMBER() OVER (
                            PARTITION BY stock_id, congressman_id
                            ORDER BY transaction_date DESC
                        ) AS rn
                    FROM transactions
                ) t ON t.stock_id = s.id AND t.rn = 1
                LEFT JOIN congressmen c ON c.id = t.congressman_id
                WHere s.ticker != '-'
                ORDER BY t.transaction_date;
            """)
            rows = cur.fetchall()
            return rows
    finally:
        release_db_connection(conn)


def create_user(email: str, password_hash: str):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (email, password_hash)
                VALUES (%s, %s)
                RETURNING id, email, created_at;
                """,
                (email.lower(), password_hash),
            )
            row = cur.fetchone()
            conn.commit()
            return {"id": row[0], "email": row[1], "created_at": row[2]}
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return None
    finally:
        release_db_connection(conn)


def get_user_by_email(email: str):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, email, password_hash, created_at
                FROM users
                WHERE email = %s;
                """,
                (email.lower(),),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {"id": row[0], "email": row[1], "password_hash": row[2], "created_at": row[3]}
    finally:
        release_db_connection(conn)


def get_user_by_id(user_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, email, created_at
                FROM users
                WHERE id = %s;
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {"id": row[0], "email": row[1], "created_at": row[2]}
    finally:
        release_db_connection(conn)


def add_favorite_stock(user_id: int, ticker: str):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO favorite_stocks (user_id, ticker)
                VALUES (%s, %s)
                ON CONFLICT (user_id, ticker) DO NOTHING
                RETURNING id, user_id, ticker, created_at;
                """,
                (user_id, ticker.upper()),
            )
            row = cur.fetchone()
            conn.commit()
            if not row:
                return None
            return {"id": row[0], "user_id": row[1], "ticker": row[2], "created_at": row[3]}
    finally:
        release_db_connection(conn)


def list_favorite_stocks(user_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ticker, created_at
                FROM favorite_stocks
                WHERE user_id = %s
                ORDER BY created_at DESC;
                """,
                (user_id,),
            )
            rows = cur.fetchall()
            return [{"ticker": r[0], "created_at": r[1]} for r in rows]
    finally:
        release_db_connection(conn)


def remove_favorite_stock(user_id: int, ticker: str) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM favorite_stocks
                WHERE user_id = %s AND ticker = %s;
                """,
                (user_id, ticker.upper()),
            )
            deleted = cur.rowcount > 0
            conn.commit()
            return deleted
    finally:
        release_db_connection(conn)



