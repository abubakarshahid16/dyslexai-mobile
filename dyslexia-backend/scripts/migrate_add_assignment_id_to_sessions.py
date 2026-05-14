"""Migration: add assignment_id column to sessions table (links session to an assignment)."""
import os
import sqlite3

DB_PATH = os.environ.get("DATABASE_URL", "dyslexia.db").replace("sqlite:///", "")


def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(sessions)")
    columns = [row[1] for row in cur.fetchall()]

    if "assignment_id" not in columns:
        print("[migration] Adding assignment_id column to sessions table...")
        cur.execute("ALTER TABLE sessions ADD COLUMN assignment_id INTEGER REFERENCES assignments(id)")
        conn.commit()
        print("[migration] Done: assignment_id column added.")
    else:
        print("[migration] assignment_id column already exists in sessions table, skipping.")

    conn.close()


if __name__ == "__main__":
    run()

