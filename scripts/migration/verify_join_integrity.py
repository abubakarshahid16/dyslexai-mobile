"""
After users + assignments exist in the same Postgres, ensure no orphan teacher_id.

Usage:
  set DATABASE_URL=postgresql://...
  python scripts/migration/verify_join_integrity.py

Exit 0 if OK, 2 if orphans found.
"""
from __future__ import annotations

import os
import sys

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


def main() -> None:
    if load_dotenv:
        repo = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        load_dotenv(os.path.join(repo, "dyslexia-backend", ".env"))

    url = os.getenv("DATABASE_URL")
    if not url or not url.lower().startswith("postgres"):
        print("DATABASE_URL must point to unified Postgres.", file=sys.stderr)
        sys.exit(1)

    import psycopg2

    conn = psycopg2.connect(url)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT COUNT(*) FROM assignments a
            WHERE a.teacher_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.teacher_id)
            """
        )
        orphans = cur.fetchone()[0]
        print(f"assignments_with_missing_teacher_user={orphans}")
        if orphans:
            sys.exit(2)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
