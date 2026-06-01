#!/usr/bin/env bash
# H4 maturity verification — extends H3 with story sync + verify-story dry-run + agent parity.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== H4 Verification ==="

echo ""
echo "[1/4] H3 baseline..."
bash scripts/verify-h3.sh

echo ""
echo "[2/4] Agent parity (.claude vs .cursor)..."
node scripts/check-agent-parity.mjs

echo ""
echo "[3/4] verify-story dry-run..."
bash scripts/verify-story.sh --dry-run

echo ""
echo "[4/4] Hook scripts present..."
for f in \
  scripts/hooks/sync-harness-story.mjs \
  scripts/hooks/run-harness-verify.mjs \
  scripts/hooks/lib-harness-task.mjs \
  scripts/verify-story.sh; do
  [[ -f "$f" ]] || { echo "  FAIL: missing $f"; exit 1; }
  echo "  ✓ $f"
done

echo ""
echo "=== H4 verification PASSED ==="
