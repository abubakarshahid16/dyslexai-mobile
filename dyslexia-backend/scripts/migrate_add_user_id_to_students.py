"""Migration: add user_id column to students table (links Student to auth User)."""
import sqlite3
import os

DB_PATH = os.environ.get("DATABASE_URL", "dyslexia.db").replace("sqlite:///", "")

def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Check if column already exists
    cur.execute("PRAGMA table_info(students)")
    columns = [row[1] for row in cur.fetchall()]

    if "user_id" not in columns:
        print("[migration] Adding user_id column to students table...")
        cur.execute("ALTER TABLE students ADD COLUMN user_id INTEGER REFERENCES users(id)")
        conn.commit()
        print("[migration] Done: user_id column added.")
    else:
        print("[migration] user_id column already exists in students table, skipping.")

    conn.close()

if __name__ == "__main__":
    run()
