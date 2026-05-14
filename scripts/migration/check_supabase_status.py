"""
Quick Supabase readiness check for demo day.

Usage (PowerShell):
  python scripts/migration/check_supabase_status.py --health-url "https://your-backend/health/db"
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


def fetch_json(url: str, timeout: int = 15) -> dict:
  req = urllib.request.Request(url, headers={"Accept": "application/json"})
  with urllib.request.urlopen(req, timeout=timeout) as response:
    body = response.read().decode("utf-8")
    try:
      return json.loads(body)
    except json.JSONDecodeError:
      return {"raw": body}


def main() -> int:
  parser = argparse.ArgumentParser(description="Check backend DB health (Supabase).")
  parser.add_argument("--health-url", required=True, help="Backend DB health endpoint URL.")
  args = parser.parse_args()

  try:
    payload = fetch_json(args.health_url)
  except urllib.error.HTTPError as exc:
    print(f"[FAIL] HTTP {exc.code} from {args.health_url}")
    return 2
  except urllib.error.URLError as exc:
    print(f"[FAIL] Network error: {exc.reason}")
    return 3
  except Exception as exc:  # noqa: BLE001
    print(f"[FAIL] Unexpected error: {exc}")
    return 4

  print("[OK] Health endpoint reachable")
  print(json.dumps(payload, indent=2))

  db_ok = payload.get("db_ok")
  if db_ok is False:
    print("[WARN] API reachable but DB not healthy.")
    return 1

  return 0


if __name__ == "__main__":
  sys.exit(main())
