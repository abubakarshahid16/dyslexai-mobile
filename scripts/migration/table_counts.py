"""
Print per-table row counts for dyslexia-backend Postgres (manifest / verification).

Usage:
  set DATABASE_URL=postgresql://...
  python scripts/migration/table_counts.py
  python scripts/migration/table_counts.py --manifest   # includes checksum-style fingerprint

Requires: psycopg2 (same as dyslexia-backend).
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", action="store_true", help="Include ordered id lists for key tables")
    args = parser.parse_args()

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    env_path = os.path.join(repo_root, "dyslexia-backend", ".env")
    if load_dotenv and os.path.isfile(env_path):
        load_dotenv(env_path)

    url = os.getenv("DATABASE_URL")
    if not url or not url.strip().lower().startswith("postgres"):
        print("DATABASE_URL must be set to a postgresql:// connection string.", file=sys.stderr)
        sys.exit(1)

    import psycopg2

    # psycopg2 connect from URL (no SQLAlchemy required for this script)
    conn = psycopg2.connect(url)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        )
        tables = [r[0] for r in cur.fetchall()]
        lines: list[str] = []
        for t in tables:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            n = cur.fetchone()[0]
            lines.append(f"{t}\t{n}")

        print("\n".join(lines))

        if args.manifest:
            # Lightweight fingerprint: concat of (table, count) — extend per-table as needed
            blob = "\n".join(lines).encode("utf-8")
            print("SHA256\t" + hashlib.sha256(blob).hexdigest())
    finally:
        conn.close()


if __name__ == "__main__":
    main()
