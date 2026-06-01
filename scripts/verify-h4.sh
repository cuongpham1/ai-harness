#!/usr/bin/env bash
# H4 maturity verification — extends H3 with story sync + batch-verify + agent parity.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== H4 Verification ==="

echo ""
echo "[1/5] H3 baseline..."
bash scripts/verify-h3.sh

echo ""
echo "[2/5] Agent parity (.claude vs .cursor)..."
node scripts/check-agent-parity.mjs

echo ""
echo "[3/5] batch-verify (stories + decisions)..."
bash scripts/batch-verify.sh --dry-run

echo ""
echo "[4/5] Hook scripts present..."
for f in \
  scripts/hooks/sync-harness-story.mjs \
  scripts/hooks/run-harness-verify.mjs \
  scripts/hooks/lib-harness-task.mjs \
  scripts/hooks/backlog-surface.mjs \
  scripts/batch-verify.sh \
  scripts/verify-story.sh; do
  [[ -f "$f" ]] || { echo "  FAIL: missing $f"; exit 1; }
  echo "  + $f"
done

echo ""
echo "[5/5] batch-verify report..."
BVREPORT="$ROOT/kg/runtime/batch-verify-last.json"
if [[ -f "$BVREPORT" ]]; then
  python3 -c "
import json, sys
d = json.load(open('$BVREPORT'))
print(f'  pass={d.get(\"pass\",0)} fail={d.get(\"fail\",0)} skip={d.get(\"skip\",0)}')
if d.get('fail', 0) > 0:
    print('  Failing stories:')
    for r in d.get('results', []):
        if r.get('result') == 'fail':
            print(f'    {r[\"id\"]}: missing {r.get(\"missing\",\"proof\")}')
" 2>/dev/null || python3 -c "import json; d=json.load(open('$BVREPORT')); print(d)"
fi

echo ""
echo "=== H4 verification PASSED ==="
