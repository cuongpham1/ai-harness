#!/usr/bin/env bash
# H4 batch proof — verify ALL stories + decisions in harness.db
# Usage:
#   bash scripts/batch-verify.sh              # batch all
#   bash scripts/batch-verify.sh --stories    # stories only
#   bash scripts/batch-verify.sh --decisions  # decisions only
#   bash scripts/batch-verify.sh --open       # only non-implemented stories
#   bash scripts/batch-verify.sh --dry-run    # print what would run, no exec
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CLI="$ROOT/scripts/bin/harness-cli"
REPORT="$ROOT/kg/runtime/batch-verify-last.json"

DRY_RUN=0
DO_STORIES=1
DO_DECISIONS=1
OPEN_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)   DRY_RUN=1; shift ;;
    --stories)   DO_DECISIONS=0; shift ;;
    --decisions) DO_STORIES=0; shift ;;
    --open)      OPEN_ONLY=1; shift ;;
    -h|--help)
      sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

[[ -x "$CLI" ]] || { echo "harness-cli not found at $CLI" >&2; exit 1; }

mkdir -p "$(dirname "$REPORT")"
json_escape() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

PASS=0
FAIL=0
SKIP=0
RESULTS=()

echo "=== batch-verify ==="

# --- Stories ---
if [[ "$DO_STORIES" -eq 1 ]]; then
  echo ""
  echo "[stories]"

  # Get all story IDs from harness.db
  STORY_IDS=()
  while IFS= read -r line; do
    id="$(echo "$line" | awk '{print $1}')"
    [[ -z "$id" || "$id" == "id" || "$id" =~ ^-+$ ]] && continue
    STORY_IDS+=("$id")
  done < <("$CLI" query sql "SELECT id FROM story ORDER BY id" 2>/dev/null || true)

  if [[ "${#STORY_IDS[@]}" -eq 0 ]]; then
    echo "  (no stories in harness.db)"
  fi

  for sid in "${STORY_IDS[@]+"${STORY_IDS[@]}"}"; do
    # Get story status
    STATUS=$("$CLI" query sql "SELECT status FROM story WHERE id=$(json_escape "$sid")" 2>/dev/null | tail -1 | xargs || true)

    if [[ "$OPEN_ONLY" -eq 1 && "$STATUS" == "implemented" ]]; then
      echo "  skip $sid (implemented)"
      ((SKIP++)) || true
      RESULTS+=("{\"id\":$(json_escape "$sid"),\"type\":\"story\",\"result\":\"skip\",\"reason\":\"implemented\"}")
      continue
    fi

    # Check proof columns
    PROOF=$("$CLI" query sql \
      "SELECT unit_test_pass, integration_test_pass FROM story WHERE id=$(json_escape "$sid")" \
      2>/dev/null | tail -1 || true)
    UNIT=$(echo "$PROOF" | awk '{print $1}')
    INTEG=$(echo "$PROOF" | awk '{print $2}')

    if [[ "$DRY_RUN" -eq 1 ]]; then
      echo "  [dry] $sid status=$STATUS unit=$UNIT integ=$INTEG"
      ((SKIP++)) || true
      RESULTS+=("{\"id\":$(json_escape "$sid"),\"type\":\"story\",\"result\":\"dry\"}")
      continue
    fi

    # Run story verify via CLI
    if "$CLI" story verify "$sid" >/dev/null 2>&1; then
      echo "  + $sid"
      ((PASS++)) || true
      RESULTS+=("{\"id\":$(json_escape "$sid"),\"type\":\"story\",\"result\":\"pass\",\"status\":\"$STATUS\"}")
    else
      # Surface missing proof
      MISSING=""
      [[ "$UNIT" != "1" ]] && MISSING="unit_test"
      [[ "$INTEG" != "1" ]] && MISSING="$MISSING,integration_test"
      MISSING="${MISSING#,}"
      echo "  x $sid (missing: ${MISSING:-proof})"
      ((FAIL++)) || true
      RESULTS+=("{\"id\":$(json_escape "$sid"),\"type\":\"story\",\"result\":\"fail\",\"missing\":$(json_escape "${MISSING:-proof}")}")
    fi
  done
fi

# --- Decisions ---
if [[ "$DO_DECISIONS" -eq 1 ]]; then
  echo ""
  echo "[decisions]"

  DEC_IDS=()
  while IFS= read -r line; do
    id="$(echo "$line" | awk '{print $1}')"
    [[ -z "$id" || "$id" == "id" || "$id" =~ ^-+$ ]] && continue
    DEC_IDS+=("$id")
  done < <("$CLI" query sql \
    "SELECT id FROM decision WHERE verify_command IS NOT NULL AND trim(verify_command) != ''" \
    2>/dev/null || true)

  if [[ "${#DEC_IDS[@]}" -eq 0 ]]; then
    echo "  (no decisions with verify_command)"
  fi

  for did in "${DEC_IDS[@]+"${DEC_IDS[@]}"}"; do
    if [[ "$DRY_RUN" -eq 1 ]]; then
      CMD=$("$CLI" query sql "SELECT verify_command FROM decision WHERE id=$(json_escape "$did")" 2>/dev/null | tail -1 || true)
      echo "  [dry] $did cmd: $CMD"
      ((SKIP++)) || true
      RESULTS+=("{\"id\":$(json_escape "$did"),\"type\":\"decision\",\"result\":\"dry\"}")
      continue
    fi

    if "$CLI" decision verify "$did" >/dev/null 2>&1; then
      echo "  + $did"
      ((PASS++)) || true
      RESULTS+=("{\"id\":$(json_escape "$did"),\"type\":\"decision\",\"result\":\"pass\"}")
    else
      echo "  x $did"
      ((FAIL++)) || true
      RESULTS+=("{\"id\":$(json_escape "$did"),\"type\":\"decision\",\"result\":\"fail\"}")
    fi
  done
fi

# --- Report ---
RESULTS_JSON="[$(IFS=,; echo "${RESULTS[*]+"${RESULTS[*]}"}")]"
REPORT_PAYLOAD="$(printf '{"ok":%s,"pass":%d,"fail":%d,"skip":%d,"dry_run":%s,"at":"%s","results":%s}' \
  "$([[ "$FAIL" -eq 0 ]] && echo true || echo false)" \
  "$PASS" "$FAIL" "$SKIP" \
  "$([[ "$DRY_RUN" -eq 1 ]] && echo true || echo false)" \
  "$TS" \
  "$RESULTS_JSON")"

echo "$REPORT_PAYLOAD" > "$REPORT"

echo ""
echo "=== batch-verify: pass=$PASS fail=$FAIL skip=$SKIP ==="

if [[ "$FAIL" -gt 0 && "$DRY_RUN" -eq 0 ]]; then
  echo "  $FAIL item(s) missing proof — run: harness-cli story update --id <ID> --unit 1 --integration 1"
  exit 1
fi
exit 0
