#!/usr/bin/env bash
# Run full AXIS test battery: unit → fuzz → stress → live (real txs)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
export PATH="$HOME/.local/bin:$PATH"

echo "══════════════════════════════════════════"
echo " AXIS Test Battery"
echo "══════════════════════════════════════════"

echo ""
echo "▶ 1/4 Unit + isolation smoke tests"
python3 -m pytest tests/ --ignore=tests/live -q --tb=short -m "not stress and not fuzz"

echo ""
echo "▶ 2/4 Fuzz tests"
python3 -m pytest tests/test_fuzz.py -q --tb=short -m fuzz

echo ""
echo "▶ 3/4 Stress tests"
python3 -m pytest tests/test_stress.py -q --tb=short -m stress

if [ ! -f "$ROOT/backend/.env" ]; then
  echo ""
  echo "⚠ Skipping live tests — backend/.env not found"
  exit 0
fi

echo ""
echo "▶ 4/4 Live tests (real Sepolia RPC, x402 txs, Aave supply)"
export RUN_LIVE_TESTS=1
python3 -m pytest tests/live/ -q --tb=short -m live

echo ""
echo "✓ All test suites passed"
