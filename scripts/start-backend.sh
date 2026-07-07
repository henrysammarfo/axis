#!/usr/bin/env bash
set -euo pipefail

echo "Starting AXIS backend on :8000"
cd "$(dirname "$0")/backend"
export PATH="$HOME/.local/bin:$PATH"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created backend/.env from example — add your API keys"
fi

python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
