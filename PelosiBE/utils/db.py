import psycopg2
from psycopg2 import pool
import os

# Database configuration - Use environment variables in production!
DB_CONFIG = {
    "host": "ep-quiet-dust-a8yflq7j-pooler.eastus2.azure.neon.tech",
    "database": "neondb",
    "user": "neondb_owner",
    "password": "npg_CArg8f6RiuWH",
    "port": "5432",
    "sslmode": "require"
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

    conn.commit()
    cur.close()
    connection_pool.putconn(conn)
    print("Database tables initialized successfully.")

def get_db_connection():
    return connection_pool.getconn()

def release_db_connection(conn):
    connection_pool.putconn(conn)