"""
Migration: Add role column to users table.

Run from dyslexia-backend:
  python scripts/migrate_add_role_to_users.py

- Adds role column to users if missing (default: "student")
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
        print("This migration only supports SQLite.")
        sys.exit(1)

    db_path = db_url.replace("sqlite:///", "").strip()
    if not Path(db_path).exists():
        print("Database not found. Will be created on next startup.")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(users)")
    cols = [row[1] for row in cur.fetchall()]
    if "role" in cols:
        print("role column already present on users. Skipping.")
        conn.close()
        return

    print("Adding role column to users...")
    cur.execute("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'student'")
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    main()
