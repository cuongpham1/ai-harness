#!/usr/bin/env bash
# apply-proposal.sh — validate and apply an approved harness improvement proposal.
#
# Usage:
#   bash scripts/apply-proposal.sh --id PROP-001
#   bash scripts/apply-proposal.sh --id PROP-001 --approve-risk=high
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROP_ID=""
APPROVE_HIGH_RISK=false
SKIP_SHIELD=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --id=*)               PROP_ID="${1#--id=}" ;;
    --id)                 PROP_ID="$2"; shift ;;
    --approve-risk=high)  APPROVE_HIGH_RISK=true ;;
    --approve-risk=*)     ;; # ignore other risk levels
    --skip-shield)        SKIP_SHIELD=true ;;
  esac
  shift
done

if [[ -z "$PROP_ID" ]]; then
  echo "Error: --id PROP-NNN is required."
  echo "Usage: bash scripts/apply-proposal.sh --id PROP-001 [--approve-risk=high]"
  exit 1
fi

if [[ ! "$PROP_ID" =~ ^PROP-[0-9]+$ ]]; then
  echo "Error: --id must match PROP-NNN format (e.g. --id=PROP-001)."
  exit 1
fi

# Find proposal file
PROP_FILE=""
for f in docs/proposals/"$PROP_ID"*.md; do
  if [[ -f "$f" ]]; then
    PROP_FILE="$f"
    break
  fi
done

if [[ -z "$PROP_FILE" ]]; then
  echo "Error: No proposal file found matching '$PROP_ID' in docs/proposals/."
  echo "Available proposals:"
  ls docs/proposals/*.md 2>/dev/null | grep -v gitkeep | sed 's|docs/proposals/||' || echo "  (none)"
  exit 1
fi

echo "=== Apply Proposal: $PROP_ID ==="
echo "File: $PROP_FILE"
echo ""

# Read Status field
STATUS=$(grep -m1 '^\*\*Status:\*\*' "$PROP_FILE" | sed 's/\*\*Status:\*\*[[:space:]]*//' | tr -d '[:space:]')

if [[ "$STATUS" != "approved" ]]; then
  echo "Error: Proposal status is '$STATUS', not 'approved'."
  echo "Set **Status:** to 'approved' in $PROP_FILE before applying."
  exit 1
fi

# Read Risk field
RISK=$(grep -m1 '^\*\*Risk:\*\*' "$PROP_FILE" | sed 's/\*\*Risk:\*\*[[:space:]]*//' | tr -d '[:space:]')

if [[ "$RISK" == "high" && "$APPROVE_HIGH_RISK" != "true" ]]; then
  echo "Error: Proposal risk is 'high'."
  echo ""
  echo "High-risk changes affect:"
  echo "  - AGENTS.md structure"
  echo "  - ARCHITECTURE.md direction"
  echo "  - TEST_MATRIX.md validation requirements"
  echo "  - Hook execution order"
  echo ""
  echo "To apply a high-risk proposal, you must pass --approve-risk=high explicitly:"
  echo "  bash scripts/apply-proposal.sh --id $PROP_ID --approve-risk=high"
  exit 1
fi

# AgentShield: run security scan before applying high-risk proposals
if [[ "$RISK" == "high" ]]; then
  if [[ "$SKIP_SHIELD" == "true" ]]; then
    if [[ "${FORCE_SKIP_SHIELD:-}" != "1" ]]; then
      echo "Error: --skip-shield requires FORCE_SKIP_SHIELD=1 set in environment by a human."
      exit 1
    fi
    echo "WARNING: AgentShield scan skipped (FORCE_SKIP_SHIELD=1 + --skip-shield). Proceeding."
    echo ""
  elif command -v node &>/dev/null && [[ -f "$ROOT/scripts/security-shield.mjs" ]]; then
    echo "--- AgentShield Security Scan ---"
    echo "Running static security scan before applying high-risk proposal..."
    SHIELD_EXIT=0
    node "$ROOT/scripts/security-shield.mjs" --scope agents,hooks --output file || SHIELD_EXIT=$?
    if [[ "$SHIELD_EXIT" == "2" ]]; then
      AUDIT_DATE=$(date +%Y-%m-%d)
      echo ""
      echo "ERROR: AgentShield found HIGH severity security issues."
      echo "Review: docs/security-audit-${AUDIT_DATE}.md"
      echo ""
      echo "Options:"
      echo "  1. Fix the HIGH severity findings, then re-run this command."
      echo "  2. Pass --skip-shield to bypass the security check (not recommended):"
      echo "     bash scripts/apply-proposal.sh --id $PROP_ID --approve-risk=high --skip-shield"
      exit 3
    elif [[ "$SHIELD_EXIT" != "0" ]]; then
      echo "WARNING: AgentShield scan encountered an error (exit $SHIELD_EXIT). Proceeding anyway."
    else
      echo "AgentShield: no HIGH severity findings. Proceeding."
    fi
    echo ""
  else
    echo "WARNING: AgentShield not available (node or scripts/security-shield.mjs missing). Skipping scan."
    echo ""
  fi
fi

# Print summary and validation plan
echo "--- Summary ---"
# Extract Summary section (lines between ## Summary and next ##)
awk '/^## Summary/{found=1; next} found && /^## /{exit} found{print}' "$PROP_FILE"

echo ""
echo "--- Validation Plan ---"
# Extract Validation Plan section
awk '/^## Validation Plan/{found=1; next} found && /^## /{exit} found{print}' "$PROP_FILE"

echo ""
if [[ "$RISK" == "high" ]]; then
  echo "WARNING: This is a HIGH-RISK proposal. --approve-risk=high flag was provided."
  echo ""
fi

# Prompt for confirmation
read -r -p "Apply this proposal? (yes/no): " ANSWER
if [[ "$ANSWER" != "yes" ]]; then
  echo "Aborted. No changes made."
  exit 0
fi

# Update Status to applied
APPLY_DATE=$(date +%Y-%m-%d)

python3 - "$PROP_FILE" "$APPLY_DATE" <<'PYEOF'
import sys, re
path = sys.argv[1]
apply_date = sys.argv[2]
content = open(path).read()
# Update Status: applied
content = re.sub(r'\*\*Status:\*\*.*', f'**Status:** applied', content)
# Append to Outcome section
if '## Outcome' in content:
    content = content.replace(
        '## Outcome\n',
        f'## Outcome\n\nApplied: {apply_date}. Outcome: [pending measurement — run validation plan commands and update this section.]\n',
        1
    )
open(path, 'w').write(content)
PYEOF

echo ""
echo "Proposal $PROP_ID marked as applied."
echo ""
echo "REMINDER: Run the validation plan commands above, then update the ## Outcome"
echo "section in $PROP_FILE with actual measured results."
echo ""
echo "When complete, move the file to docs/proposals/archive/ :"
echo "  mv $PROP_FILE docs/proposals/archive/"

exit 0
