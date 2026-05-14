"""
Migration: Add user_id to ocr_runs for per-user ownership.

Run from dyslexia-backend:
  python scripts/migrate_add_user_id_to_ocr_runs.py

- Creates users table if missing (SQLAlchemy models)
- Adds user_id column to ocr_runs if missing
- Legacy runs (user_id=None) are excluded from user-scoped queries
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

def main():
    import sqlite3
    from app.database import engine, Base
    import app.models  # noqa: ensure models registered

    db_url = os.getenv("DATABASE_URL", "sqlite:///./dyslexia.db")
    if not db_url.startswith("sqlite"):
        print("This migration only supports SQLite. For PostgreSQL, run equivalent ALTER TABLE manually.")
        sys.exit(1)

    db_path = db_url.replace("sqlite:///", "").strip()
    if not Path(db_path).exists():
        print("Database not found. Creating via Base.metadata.create_all() for fresh install.")
        Base.metadata.create_all(bind=engine)
        print("Done.")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Ensure users table exists
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    if not cur.fetchone():
        print("Creating users table...")
        Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables["users"]])
        print("Users table created.")
    else:
        print("Users table exists.")

    # Check if user_id column exists on ocr_runs
    cur.execute("PRAGMA table_info(ocr_runs)")
    cols = [row[1] for row in cur.fetchall()]
    if "user_id" in cols:
        print("user_id already present on ocr_runs. Skipping.")
        conn.close()
        return

    print("Adding user_id to ocr_runs...")
    cur.execute("ALTER TABLE ocr_runs ADD COLUMN user_id INTEGER REFERENCES users(id)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_ocr_runs_user_id ON ocr_runs(user_id)")
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    main()
