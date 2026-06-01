#!/usr/bin/env bash
# H5 maturity verification — self-improvement loop.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

check() {
  local label="$1"
  local ok="$2"
  if [[ "$ok" == "true" ]]; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== H5 Verification ==="
echo ""

# [1/6] docs/SELF_IMPROVE.md exists
echo "[1/6] docs/SELF_IMPROVE.md..."
if [[ -f "docs/SELF_IMPROVE.md" ]]; then
  check "docs/SELF_IMPROVE.md exists" "true"
else
  check "docs/SELF_IMPROVE.md exists" "false"
fi

# [2/6] docs/templates/harness-proposal.md exists
echo ""
echo "[2/6] docs/templates/harness-proposal.md..."
if [[ -f "docs/templates/harness-proposal.md" ]]; then
  check "docs/templates/harness-proposal.md exists" "true"
else
  check "docs/templates/harness-proposal.md exists" "false"
fi

# [3/6] docs/proposals/ directory exists
echo ""
echo "[3/6] docs/proposals/ directory..."
if [[ -d "docs/proposals" ]]; then
  check "docs/proposals/ directory exists" "true"
else
  check "docs/proposals/ directory exists" "false"
fi

# [4/6] h5-structural-audit.mjs runs without error
echo ""
echo "[4/6] h5-structural-audit.mjs runs (exit 0)..."
if [[ -f "scripts/h5-structural-audit.mjs" ]]; then
  if node scripts/h5-structural-audit.mjs > /dev/null 2>&1; then
    check "scripts/h5-structural-audit.mjs exits 0" "true"
  else
    check "scripts/h5-structural-audit.mjs exits 0" "false"
  fi
else
  check "scripts/h5-structural-audit.mjs exists" "false"
fi

# [5/6] propose-change.mjs exists and is executable (node can parse it)
echo ""
echo "[5/6] scripts/propose-change.mjs..."
if [[ -f "scripts/propose-change.mjs" ]]; then
  if node --check scripts/propose-change.mjs 2>/dev/null; then
    check "scripts/propose-change.mjs exists and is valid JS" "true"
  else
    check "scripts/propose-change.mjs is valid JS" "false"
  fi
else
  check "scripts/propose-change.mjs exists" "false"
fi

# [6/6] apply-proposal.sh contains approve-risk=high (human gate)
echo ""
echo "[6/6] scripts/apply-proposal.sh human gate..."
if [[ -f "scripts/apply-proposal.sh" ]]; then
  if grep -q 'approve-risk=high' scripts/apply-proposal.sh; then
    check "scripts/apply-proposal.sh contains approve-risk=high gate" "true"
  else
    check "scripts/apply-proposal.sh contains approve-risk=high gate" "false"
  fi
else
  check "scripts/apply-proposal.sh exists" "false"
fi

echo ""
echo "--- Results: ${PASS} passed, ${FAIL} failed ---"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo "=== H5 verification FAILED ==="
  exit 1
else
  echo "=== H5 verification PASSED ==="
  exit 0
fi
