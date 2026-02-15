import os

import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

def _get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value

# Database configuration - Use environment variables
DB_CONFIG = {
    "host": _get_required_env("DB_HOST"),
    "database": _get_required_env("DB_NAME"),
    "user": _get_required_env("DB_USER"),
    "password": _get_required_env("DB_PASSWORD"),
    "port": _get_required_env("DB_PORT"),
    "sslmode": _get_required_env("DB_SSLMODE"),
}

# Initialize connection pool
connection_pool = None

def init_db():
    global connection_pool
    if not connection_pool:
        connection_pool = psycopg2.pool.SimpleConnectionPool(1, 10, **DB_CONFIG)
    
    conn = connection_pool.getconn()
    cur = conn.cursor()
    
    # Table 1: Raw Data (Full Scraped Data)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS trades_raw (
        id SERIAL PRIMARY KEY,
        raw_content JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Table 2: Congressmen
    cur.execute("""
    CREATE TABLE IF NOT EXISTS congressmen (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        chamber VARCHAR(50),
        party VARCHAR(10)
    );
    """)

    # Table 3: Stocks
    cur.execute("""
    CREATE TABLE IF NOT EXISTS stocks (
        id SERIAL PRIMARY KEY,
        ticker VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(100) UNIQUE NOT NULL,
        company_name TEXT
    );
    """)

    # Table 4: Transactions (The link table)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        congressman_id INTEGER REFERENCES congressmen(id),
        stock_id INTEGER REFERENCES stocks(id),
        transaction_type VARCHAR(20), -- Purchase/Sale
        transaction_date DATE,
        amount_range VARCHAR(100),
        UNIQUE(congressman_id, stock_id, transaction_date, amount_range, transaction_type)
    );
    """)

    # Table 5: Users
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Table 6: Favorite stocks (user-scoped)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS favorite_stocks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ticker VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, ticker)
    );
    """)

    conn.commit()
    cur.close()
    connection_pool.putconn(conn)
    print("Database tables initialized successfully.")

def get_db_connection():
    return connection_pool.getconn()

def release_db_connection(conn):
    connection_pool.putconn(conn)