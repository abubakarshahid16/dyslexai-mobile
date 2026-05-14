"""Migration: add feedback column to sessions table (stores LLM feedback text)."""
import os
import sqlite3

DB_PATH = os.environ.get("DATABASE_URL", "dyslexia.db").replace("sqlite:///", "")


def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(sessions)")
    columns = [row[1] for row in cur.fetchall()]

    if "feedback" not in columns:
        print("[migration] Adding feedback column to sessions table...")
        cur.execute("ALTER TABLE sessions ADD COLUMN feedback TEXT")
        conn.commit()
        print("[migration] Done: feedback column added.")
    else:
        print("[migration] feedback column already exists in sessions table, skipping.")

    conn.close()


if __name__ == "__main__":
    run()

