#!/usr/bin/env bash
# Start AXIS backend + frontend for local development.
# Usage: ./scripts/dev.sh   (or: npm run dev:all)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PORT="${AXIS_BACKEND_PORT:-8000}"
FRONTEND_PORT="${AXIS_FRONTEND_PORT:-5173}"

red() { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }

cleanup() {
  yellow "\nStopping AXIS dev servers…"
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

port_in_use() {
  lsof -i ":$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

echo "AXIS local dev — backend :$BACKEND_PORT, frontend :$FRONTEND_PORT"
echo ""

# --- env files ---
if [[ ! -f "$ROOT/.env" ]]; then
  red "Missing $ROOT/.env — copy .env.example and fill in keys (see docs/KEYS_SETUP.md)"
  exit 1
fi
if [[ ! -f "$ROOT/backend/.env" ]]; then
  red "Missing $ROOT/backend/.env — copy backend/.env.example and fill in keys"
  exit 1
fi

# --- frontend deps ---
if [[ ! -d "$ROOT/node_modules" ]]; then
  yellow "Installing frontend dependencies (npm install)…"
  (cd "$ROOT" && npm install)
fi

# --- backend env check ---
if ! (cd "$ROOT" && python3 scripts/validate-env.py); then
  red "Backend env validation failed. Fix backend/.env then retry."
  exit 1
fi

# --- port checks ---
if port_in_use "$BACKEND_PORT"; then
  yellow "Port $BACKEND_PORT already in use — stop the other process or set AXIS_BACKEND_PORT"
  lsof -i ":$BACKEND_PORT" -sTCP:LISTEN 2>/dev/null || true
  exit 1
fi
if port_in_use "$FRONTEND_PORT"; then
  yellow "Port $FRONTEND_PORT already in use — stop the other process or set AXIS_FRONTEND_PORT"
  lsof -i ":$FRONTEND_PORT" -sTCP:LISTEN 2>/dev/null || true
  exit 1
fi

green "Starting backend on http://localhost:$BACKEND_PORT"
(
  cd "$ROOT/backend"
  pip install -q -r requirements.txt
  exec python3 -m uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload
) &
BACKEND_PID=$!

# Wait for backend health
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
if ! curl -sf "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then
  red "Backend failed to start. Check output above."
  exit 1
fi

green "Starting frontend on http://localhost:$FRONTEND_PORT"
(
  cd "$ROOT"
  exec npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

echo ""
green "AXIS is running locally:"
echo "  Frontend:  http://localhost:$FRONTEND_PORT"
echo "  Onboard:    http://localhost:$FRONTEND_PORT/onboard"
echo "  Backend:    http://localhost:$BACKEND_PORT"
echo "  API health: http://localhost:$BACKEND_PORT/health"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

wait
