#!/usr/bin/env bash
# H4 thin slice — lane-aware stack verification for active task / story proof.
# Usage:
#   bash scripts/verify-story.sh              # active task, run checks
#   bash scripts/verify-story.sh --dry-run    # validate config only (CI)
#   bash scripts/verify-story.sh --task task-042
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DRY_RUN=0
TASK_ARG=""
BLOCK=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --task) TASK_ARG="${2:-}"; shift 2 ;;
    --block) BLOCK=1; shift ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

REPORT="$ROOT/kg/runtime/verify-last.json"
mkdir -p "$(dirname "$REPORT")"

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' <<<"$1"
}

fail_report() {
  local msg="$1"
  local code="${2:-1}"
  local tid="${3:-}"
  printf '{"ok":false,"proof":false,"task":%s,"message":%s,"at":"%s"}\n' \
    "$(json_escape "${tid}")" "$(json_escape "$msg")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$REPORT"
  echo "verify-story: $msg" >&2
  exit "$code"
}

pick_task() {
  if [[ -n "$TASK_ARG" ]]; then
    local f="$ROOT/.project-manager/tasks/${TASK_ARG}.md"
    [[ -f "$f" ]] || fail_report "task not found: $TASK_ARG" 1 "$TASK_ARG"
    echo "$f"
    return
  fi
  python3 - "$ROOT" <<'PY'
import re, sys
from pathlib import Path

root = Path(sys.argv[1])
tasks = root / ".project-manager" / "tasks"
if not tasks.is_dir():
    sys.exit(0)

def fields(text, name):
    m = re.search(rf"\*\*{re.escape(name)}:\*\*\s*(.+?)(?=\n|$)", text, re.I)
    return m.group(1).strip() if m else ""

candidates = []
for p in sorted(tasks.glob("*.md"), key=lambda x: x.stat().st_mtime, reverse=True):
    text = p.read_text(encoding="utf-8", errors="replace")
    status = fields(text, "Status").lower().replace(" ", "_")
    candidates.append((status == "in_progress", p.stat().st_mtime, p))

if not candidates:
    sys.exit(0)

candidates.sort(key=lambda x: (not x[0], -x[1]))
print(candidates[0][2])
PY
}

TASK_FILE="$(pick_task || true)"
if [[ -z "$TASK_FILE" ]]; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '{"ok":true,"proof":false,"skipped":"no_tasks","dry_run":true}\n' >"$REPORT"
    echo "verify-story: dry-run OK (no tasks)"
    exit 0
  fi
  fail_report "no task file in .project-manager/tasks/" 0 ""
fi

TASK_ID="$(basename "$TASK_FILE" .md)"
TASK_CONTENT="$(<"$TASK_FILE")"

LANE="$(python3 -c "
import re, sys
t = open(sys.argv[1]).read()
m = re.search(r'\*\*Lane:\*\*\s*(.+?)(?=\n|$)', t, re.I)
lane = (m.group(1).strip() if m else 'normal').lower().replace(' ', '_').replace('-', '_')
if lane in ('highrisk',): lane = 'high_risk'
if lane not in ('tiny', 'normal', 'high_risk'): lane = 'normal'
print(lane)
" "$TASK_FILE")"

STORY_ID="$(python3 -c "
import re, sys
t = open(sys.argv[1]).read()
for name in ('Story ID',):
    m = re.search(rf'\*\*{name}:\*\*\s*(.+?)(?=\n|$)', t, re.I)
    if m:
        s = m.group(1).strip().strip('()')
        if s and s.lower() != 'optional':
            print(s)
            break
" "$TASK_FILE")"

OUTCOME="$(python3 -c "
import re, sys
t = open(sys.argv[1]).read()
blocks = re.findall(r'### After-Work — [^\n]+\n([\s\S]*?)(?=### After-Work —|\Z)', t)
if not blocks:
    print('')
    sys.exit(0)
body = blocks[-1]
m = re.search(r'\*\*Outcome:\*\*\s*(\S+)', body, re.I)
print(m.group(1).lower() if m else '')
" "$TASK_FILE")"

FRAMEWORK=""
if [[ -f "$ROOT/.harness-profile" ]]; then
  FRAMEWORK="$(tr -d '[:space:]' <"$ROOT/.harness-profile")"
fi

PROFILE_JSON=""
if [[ -n "$FRAMEWORK" && -f "$ROOT/frameworks/$FRAMEWORK/profile.json" ]]; then
  PROFILE_JSON="$ROOT/frameworks/$FRAMEWORK/profile.json"
elif [[ -f "$ROOT/.harness-verify.json" ]]; then
  PROFILE_JSON="$ROOT/.harness-verify.json"
elif [[ -n "$FRAMEWORK" && -f "$ROOT/../frameworks/$FRAMEWORK/profile.json" ]]; then
  PROFILE_JSON="$ROOT/../frameworks/$FRAMEWORK/profile.json"
fi

read_profile_cmd() {
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get(sys.argv[2],'') or '')" "$PROFILE_JSON" "$1"
}

LINT_CMD=""
TEST_CMD=""
if [[ -n "$PROFILE_JSON" ]]; then
  LINT_CMD="$(read_profile_cmd lint_cmd)"
  TEST_CMD="$(read_profile_cmd test_cmd)"
fi

# Installer repo without .harness-profile: use local Rust when Cargo.toml present
if [[ -z "$TEST_CMD" && -f "$ROOT/Cargo.toml" ]]; then
  LINT_CMD="${LINT_CMD:-cargo fmt --check}"
  TEST_CMD="cargo test --quiet"
fi

echo "=== verify-story ($TASK_ID, lane=$LANE) ==="

if [[ "$LANE" == "tiny" ]]; then
  printf '{"ok":true,"proof":true,"lane":"tiny","task":%s,"skipped_stack":true,"evidence":"lane:tiny"}\n' "$(json_escape "$TASK_ID")" >"$REPORT"
  echo "  tiny lane — stack checks skipped"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  printf '{"ok":true,"proof":false,"dry_run":true,"task":%s,"lane":%s,"lint":%s,"test":%s}\n' \
    "$(json_escape "$TASK_ID")" "$(json_escape "$LANE")" \
    "$(json_escape "$LINT_CMD")" "$(json_escape "$TEST_CMD")" >"$REPORT"
  echo "  dry-run OK (lane=$LANE lint=${LINT_CMD:-none} test=${TEST_CMD:-none})"
  exit 0
fi

# Only run heavy checks when After-Work Outcome is explicitly completed
if [[ "$OUTCOME" != "completed" ]]; then
  printf '{"ok":false,"proof":false,"skipped":"outcome_%s","task":%s}\n' "${OUTCOME:-missing}" "$(json_escape "$TASK_ID")" >"$REPORT"
  echo "  outcome=${OUTCOME:-<missing>} — stack checks skipped (need Outcome: completed)"
  exit 0
fi

if [[ -z "$LINT_CMD" && -z "$TEST_CMD" ]]; then
  fail_report "no lint/test commands (set .harness-profile + framework profile or Cargo.toml)" $((BLOCK ? 2 : 0)) "$TASK_ID"
fi

FAILED=0
EVIDENCE=()

run_step() {
  local label="$1"
  local cmd="$2"
  [[ -z "$cmd" ]] && return 0
  echo "  [$label] $cmd"
  if bash -c "cd \"$ROOT\" && $cmd"; then
    EVIDENCE+=("$label:pass")
    return 0
  fi
  EVIDENCE+=("$label:fail")
  FAILED=1
  return 1
}

run_step lint "$LINT_CMD" || true
run_step test "$TEST_CMD" || true

# high-risk: verify ADRs that define verify_command in harness.db
if [[ "$LANE" == "high_risk" && -x "$ROOT/scripts/bin/harness-cli" ]]; then
  echo "  [decisions] harness-cli decision verify"
  while IFS= read -r dec_id; do
    [[ -z "$dec_id" ]] && continue
    if (cd "$ROOT" && scripts/bin/harness-cli decision verify "$dec_id" >/dev/null 2>&1); then
      EVIDENCE+=("decision:${dec_id}:pass")
    else
      EVIDENCE+=("decision:${dec_id}:fail")
      FAILED=1
    fi
  done < <(
    cd "$ROOT" && scripts/bin/harness-cli query sql \
      "SELECT id FROM decision WHERE verify_command IS NOT NULL AND trim(verify_command) != ''" 2>/dev/null \
      | tail -n +2 | awk '{print $1}' || true
  )
fi

EVIDENCE_STR="$(IFS=,; echo "${EVIDENCE[*]}")"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ "$FAILED" -eq 0 ]]; then
  if [[ -n "$STORY_ID" && -x "$ROOT/scripts/bin/harness-cli" ]]; then
    (cd "$ROOT" && scripts/bin/harness-cli story update \
      --id "$STORY_ID" \
      --status implemented \
      --unit true \
      --evidence "verify-story $TS ($EVIDENCE_STR)") 2>/dev/null \
      || echo "  ⚠ story update skipped ($STORY_ID not in DB — run story add or import)" >&2
  fi
  printf '{"ok":true,"proof":true,"task":%s,"lane":%s,"evidence":%s,"at":%s}\n' \
    "$(json_escape "$TASK_ID")" "$(json_escape "$LANE")" \
    "$(json_escape "$EVIDENCE_STR")" "$(json_escape "$TS")" >"$REPORT"
  echo "=== verify-story PASSED ==="
  exit 0
fi

printf '{"ok":false,"proof":false,"task":%s,"lane":%s,"evidence":%s,"at":%s}\n' \
  "$(json_escape "$TASK_ID")" "$(json_escape "$LANE")" \
  "$(json_escape "$EVIDENCE_STR")" "$(json_escape "$TS")" >"$REPORT"
echo "=== verify-story FAILED ===" >&2
exit $((BLOCK ? 2 : 1))
