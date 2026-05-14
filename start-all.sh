#!/usr/bin/env bash
# Start full DyslexAI stack with one command: DB, exercise backend, scan backend, Expo.
# Run from repo root: ./start-all.sh
# Optional: USE_ONNX=1 ./start-all.sh to use ONNX for scan backend (lower latency on CPU).

set -e
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

echo "DyslexAI – starting all services from $REPO_ROOT"

# 1. PostgreSQL (Docker)
echo ""
echo "[1/4] PostgreSQL..."
if command -v docker &>/dev/null; then
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^dyslexia-db$'; then
    docker start dyslexia-db 2>/dev/null || true
    echo "  Started existing container dyslexia-db"
  else
    echo "  Creating container (first time)..."
    docker run --name dyslexia-db -e POSTGRES_DB=dyslexia_db -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres:15
    echo "  Created and started dyslexia-db"
  fi
  sleep 2
else
  echo "  Docker not found. Exercise backend may fail if DB is required."
fi

# 2. Exercise backend (port 8001) – background
echo ""
echo "[2/4] Exercise backend (8001)..."
EXERCISE_DIR="$REPO_ROOT/dyslexia-backend"
(
  cd "$EXERCISE_DIR"
  [ -f venv/bin/activate ] && . venv/bin/activate
  python db/migrate_stroke_errors.py 2>/dev/null || true
  python db/seed.py 2>/dev/null || true
  exec uvicorn app.main:app --host 0.0.0.0 --port 8001
) &
EXERCISE_PID=$!
sleep 3

# 3. Scan backend (port 8000) – background (optionally USE_ONNX or USE_INT8)
echo ""
echo "[3/4] Scan backend (8000)..."
SCAN_DIR="$REPO_ROOT/scan-backend"
(
  cd "$SCAN_DIR"
  [ -f venv/bin/activate ] && . venv/bin/activate
  [ -n "$USE_ONNX" ] && export USE_ONNX
  [ -n "$USE_INT8" ] && export USE_INT8
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000
) &
SCAN_PID=$!
sleep 2

# 4. Expo (foreground)
echo ""
echo "[4/4] Expo app..."
echo "  Backends: 8000 (scan), 8001 (exercises). Press 'a' for Android or scan QR with Expo Go."
echo ""
trap "kill $EXERCISE_PID $SCAN_PID 2>/dev/null; exit" INT TERM
cd "$REPO_ROOT/DyslexAI-Mobile"
exec npx expo start
