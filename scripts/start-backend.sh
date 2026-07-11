#!/usr/bin/env bash
set -euo pipefail

echo "Starting AXIS backend on :8000"
ROOT="$(dirname "$0")/.."
cd "$ROOT/backend"
export PATH="$HOME/.local/bin:$PATH"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created backend/.env from example — fill in ALL keys (see docs/KEYS_SETUP.md)"
  exit 1
fi

python3 "$ROOT/scripts/validate-env.py" || exit 1

python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
