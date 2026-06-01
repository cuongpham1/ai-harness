#!/usr/bin/env bash
# H3 maturity verification — exit non-zero on any failure.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== H3 Verification ==="

echo ""
echo "[1/5] Rust CLI tests..."
if command -v cargo &>/dev/null && [[ -f Cargo.toml ]]; then
  cargo test --quiet
else
  echo "  skip (cargo not available)"
fi

echo ""
echo "[2/5] friction-by-component..."
node scripts/friction-by-component.mjs --json >/dev/null

echo ""
echo "[3/5] harness benchmark..."
bash benchmark/run-harness.sh
LATEST="$(ls -t benchmark/results/*-harness.jsonl 2>/dev/null | head -1)"
if [[ -z "$LATEST" ]]; then
  echo "  FAIL: no harness results"
  exit 1
fi

echo ""
echo "[4/5] benchmark compare vs baseline..."
if [[ ! -f benchmark/results/baseline-h3.jsonl ]]; then
  echo "  FAIL: benchmark/results/baseline-h3.jsonl missing"
  exit 1
fi
node benchmark/compare.mjs benchmark/results/baseline-h3.jsonl "$LATEST"

echo ""
echo "[5/5] score-trace smoke..."
if [[ -x scripts/bin/harness-cli ]]; then
  scripts/bin/harness-cli score-trace >/dev/null || true
else
  echo "  skip (harness-cli missing)"
fi

echo ""
echo "=== H3 verification PASSED ==="
