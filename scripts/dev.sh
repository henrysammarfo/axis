#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting AXIS backend on http://localhost:8000"
(
  cd "$ROOT/backend"
  pip install -q -r requirements.txt
  exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
) &

echo "Starting AXIS frontend on http://localhost:5173"
(
  cd "$ROOT"
  exec npm run dev -- --host 0.0.0.0 --port 5173
) &

wait
