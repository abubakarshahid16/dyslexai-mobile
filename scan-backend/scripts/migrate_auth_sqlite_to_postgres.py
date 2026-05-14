"""
Lossless copy of users from SQLite (dyslexai_auth.db) into PostgreSQL.

Preserves id, email, password_hash, name, role, created_at exactly.

Prereqs:
  - Target Postgres has public.users (run scan-backend once with AUTH_DATABASE_URL set, or create via SQLAlchemy init_auth_db).
  - Set AUTH_DATABASE_URL or DATABASE_URL to target PostgreSQL.

Usage (from repo root, scan-backend venv):
  python scan-backend/scripts/migrate_auth_sqlite_to_postgres.py --sqlite path/to/dyslexai_auth.db

Dry run (compare counts only):
  python scan-backend/scripts/migrate_auth_sqlite_to_postgres.py --sqlite ... --verify-only
"""
from __future__ import annotations

import argparse
import os
import sys

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


def _pg_url() -> str:
    u = (os.environ.get("AUTH_DATABASE_URL") or "").strip()
    if u:
        return u
    u = (os.environ.get("DATABASE_URL") or "").strip()
    if u.lower().startswith(("postgresql://", "postgres://")):
        return u
    return ""


def ensure_users_table(engine) -> None:
    """
    dyslexia pg_dump does not include users (auth was SQLite). Create public.users
    matching scan-backend User model before INSERT from SQLite.
    """
    from sqlalchemy import text

    ddl = """
    CREATE TABLE IF NOT EXISTS public.users (
        id INTEGER PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'student',
        created_at TIMESTAMP WITH TIME ZONE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON public.users (email);
    """
    with engine.begin() as conn:
        conn.execute(text(ddl))


def main() -> None:
    if load_dotenv:
        here = os.path.dirname(os.path.abspath(__file__))
        scan_root = os.path.dirname(here)
        load_dotenv(os.path.join(scan_root, ".env"))

    p = argparse.ArgumentParser()
    p.add_argument("--sqlite", required=True, help="Path to dyslexai_auth.db")
    p.add_argument("--verify-only", action="store_true", help="Compare row counts and hashes only")
    args = p.parse_args()

    sqlite_path = os.path.abspath(args.sqlite)
    if not os.path.isfile(sqlite_path):
        print(f"SQLite file not found: {sqlite_path}", file=sys.stderr)
        sys.exit(1)

    pg_url = _pg_url()
    if not pg_url:
        print("Set AUTH_DATABASE_URL or DATABASE_URL to PostgreSQL.", file=sys.stderr)
        sys.exit(1)

    import sqlite3

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    conn_sql = sqlite3.connect(sqlite_path)
    cur_sql = conn_sql.cursor()
    cur_sql.execute(
        "SELECT id, email, password_hash, name, role, created_at FROM users ORDER BY id"
    )
    rows_sql = cur_sql.fetchall()
    conn_sql.close()

    engine = create_engine(pg_url, pool_pre_ping=True)
    ensure_users_table(engine)
    Session = sessionmaker(bind=engine)

    if args.verify_only:
        with engine.connect() as c:
            n = c.execute(text("SELECT COUNT(*) FROM users")).scalar()
            mismatches = 0
            for row in rows_sql:
                uid, email, ph, name, role, _ca = row
                got = c.execute(
                    text(
                        "SELECT password_hash FROM users WHERE id = :id AND email = :email"
                    ),
                    {"id": uid, "email": email},
                ).fetchone()
                if not got or got[0] != ph:
                    print(f"MISMATCH id={uid} email={email}", file=sys.stderr)
                    mismatches += 1
        print(f"sqlite_rows={len(rows_sql)} postgres_users={n} hash_mismatches={mismatches}")
        if len(rows_sql) != n or mismatches:
            sys.exit(2)
        return

    session = Session()
    try:
        for row in rows_sql:
            uid, email, ph, name, role, created_at = row
            session.execute(
                text(
                    """
                    INSERT INTO users (id, email, password_hash, name, role, created_at)
                    VALUES (:id, :email, :password_hash, :name, :role, :created_at)
                    ON CONFLICT (id) DO UPDATE SET
                      email = EXCLUDED.email,
                      password_hash = EXCLUDED.password_hash,
                      name = EXCLUDED.name,
                      role = EXCLUDED.role,
                      created_at = EXCLUDED.created_at
                    """
                ),
                {
                    "id": uid,
                    "email": email,
                    "password_hash": ph,
                    "name": name,
                    "role": role or "student",
                    "created_at": created_at,
                },
            )
        session.commit()
        print(f"Migrated {len(rows_sql)} users OK.")
    except Exception as e:
        session.rollback()
        print(f"Migration failed: {e}", file=sys.stderr)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
