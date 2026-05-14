"""
Post-migration sanity check: users table exists, counts, no orphan teacher_ids.

Usage (repo root):
  python scripts/migration/verify_supabase_complete.py

Reads DATABASE_URL from dyslexia-backend/.env
"""
from __future__ import annotations

import os
import sys

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


def main() -> None:
    repo = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    env_path = os.path.join(repo, "dyslexia-backend", ".env")
    if load_dotenv and os.path.isfile(env_path):
        load_dotenv(env_path)
    if not os.getenv("DATABASE_URL") and os.path.isfile(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip().strip('"')
                    break

    url = os.getenv("DATABASE_URL", "").strip()
    if not url or not url.lower().startswith("postgres"):
        print("ERROR: DATABASE_URL missing in dyslexia-backend/.env", file=sys.stderr)
        sys.exit(1)

    import psycopg2

    conn = psycopg2.connect(url)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'users'
            )
            """
        )
        if not cur.fetchone()[0]:
            print("FAIL: public.users does not exist")
            sys.exit(2)

        cur.execute("SELECT COUNT(*) FROM users")
        nu = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM exercises")
        ne = cur.fetchone()[0]
        cur.execute(
            """
            SELECT COUNT(*) FROM assignments a
            WHERE a.teacher_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.teacher_id)
            """
        )
        orphans = cur.fetchone()[0]

        print(f"OK  users={nu}  exercises={ne}  assignments_with_bad_teacher_id={orphans}")
        if orphans:
            sys.exit(3)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
