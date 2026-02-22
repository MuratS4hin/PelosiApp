import json
import logging
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import Json 
from .db import get_db_connection, release_db_connection
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
import secrets
import os
from dotenv import load_dotenv

load_dotenv()

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


def delete_user(user_id: int) -> bool:
    """Delete a user and all their associated data (favorites)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # First delete all favorites (due to foreign key constraint)
            cur.execute(
                "DELETE FROM favorite_stocks WHERE user_id = %s;",
                (user_id,),
            )
            # Then delete the user
            cur.execute(
                "DELETE FROM users WHERE id = %s;",
                (user_id,),
            )
            deleted = cur.rowcount > 0
            conn.commit()
            return deleted
    finally:
        release_db_connection(conn)

def request_password_reset(email: str) -> bool:
    """Generate a password reset token and send an email to the user."""
    user = get_user_by_email(email)
    if not user:
        # For security, we don't reveal if email exists
        return True
    
    token = generate_reset_token()
    expiration = datetime.now() + timedelta(minutes=10)
    
    if not add_password_reset_token(user["id"], token, expiration):
        return False
    
    if not send_password_reset_email(user["email"], token):
        return False
    
    return True


def add_password_reset_token(user_id: int, token: str, expiration: datetime) -> bool:
    """Store the password reset token in the database for the user."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE users
                SET reset_token = %s, reset_token_expiration = %s
                WHERE id = %s;
                """,
                (token, expiration, user_id),
            )
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logging.error(f"Error storing reset token: {e}")
        return False
    finally:
        release_db_connection(conn)


def verify_reset_token(token: str) -> dict:
    """Verify if the reset token is valid and return the user."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, email, reset_token_expiration
                FROM users
                WHERE reset_token = %s;
                """,
                (token,),
            )
            row = cur.fetchone()
            if not row:
                return None
            
            user_id, email, expiration = row[0], row[1], row[2]
            
            # Check if token has expired
            if expiration < datetime.now():
                return None
            
            return {"id": user_id, "email": email}
    finally:
        release_db_connection(conn)


def reset_password(token: str, new_password_hash: str) -> bool:
    """Reset the user's password and clear the reset token."""
    user = verify_reset_token(token)
    if not user:
        return False
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE users
                SET password_hash = %s, reset_token = NULL, reset_token_expiration = NULL
                WHERE id = %s;
                """,
                (new_password_hash, user["id"]),
            )
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logging.error(f"Error resetting password: {e}")
        return False
    finally:
        release_db_connection(conn)


def send_password_reset_email(email: str, code: str) -> bool:
    """Send a password reset email to the user using SMTP with a 6-digit code."""
    try:
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        sender_email = os.getenv("SENDER_EMAIL") 
        gmail_auth_email = os.getenv("GMAIL_AUTH_EMAIL") 
        sender_password = os.getenv("SENDER_PASSWORD") 
        
        if not sender_email or not sender_password or not gmail_auth_email:
            logging.error("Email credentials not configured")
            return False
        
        subject = "Password Reset Code - Portrace App"
        body = f"""
        Hello,

        You have requested to reset your password for your Portrace App account. 
        If you did not make this request, please ignore this email.

        Your password reset code is:
        {code}

        Enter this code in the Portrace App to proceed with resetting your password.
        This code will expire in 10 minutes.

        Best regards,
        Portrace App Team
        """
        
        msg = MIMEMultipart()
        msg["From"] = formataddr(("Portrace App Team", sender_email)) 
        msg["To"] = email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.set_debuglevel(1)
            server.login(gmail_auth_email, sender_password)
            server.send_message(msg)
        
        logging.info(f"Password reset code email sent to {email}")
        return True
    except Exception as e:
        logging.error(f"Error sending password reset email: {e}")
        return False


def generate_reset_token() -> str:
    """Generate a 6-digit code for password reset."""
    import random
    return str(random.randint(100000, 999999))



