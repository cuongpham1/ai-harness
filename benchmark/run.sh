#!/usr/bin/env bash
# Benchmark runner — runs tasks from benchmark/tasks/*.json and records results.
# Results written to benchmark/results/YYYY-MM-DD-HH-MM.jsonl

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASKS_DIR="${TASKS_DIR:-$SCRIPT_DIR/tasks}"
RESULTS_DIR="$SCRIPT_DIR/results"

mkdir -p "$RESULTS_DIR"

TIMESTAMP="$(date -u +%Y-%m-%d-%H-%M)"
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
RESULTS_FILE="$RESULTS_DIR/$TIMESTAMP.jsonl"

echo ""
echo "=== Benchmark Runner ==="
echo "Tasks dir : $TASKS_DIR"
echo "Results   : $RESULTS_FILE"
echo ""

pass_count=0
fail_count=0
total=0

for task_file in "$TASKS_DIR"/*.json; do
  [[ -f "$task_file" ]] || continue

  task_id="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$task_file','utf8')).id||'unknown')" 2>/dev/null || echo "unknown")"
  category="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$task_file','utf8')).category||'')" 2>/dev/null || echo "")"
  difficulty="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$task_file','utf8')).difficulty||'')" 2>/dev/null || echo "")"
  prompt="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$task_file','utf8')).prompt||'')" 2>/dev/null || echo "")"
  timeout_s="$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('$task_file','utf8')).timeout_seconds||60))" 2>/dev/null || echo "60")"

  echo "Running task: $task_id ($category / $difficulty)"

  start_ts="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
  start_epoch="$(date +%s)"

  claude_output=""
  pass=false
  fail_reason=""

  # TODO: Replace the following block with your actual claude CLI invocation.
  # Example (adjust flags for your claude version):
  #   claude_output="$(timeout "$timeout_s" claude -p "$prompt" --output-format json 2>/dev/null | jq -r '.result // .content // ""' || true)"
  #
  # For now we use a no-op placeholder so the harness can run without a live claude binary:
  claude_output="(benchmark claude call not configured — edit benchmark/run.sh TODO block)"
  exit_code=0

  end_epoch="$(date +%s)"
  end_ts="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
  duration_ms=$(( (end_epoch - start_epoch) * 1000 ))

  # Validate expected files + content
  files_json="$(node -e "const t=JSON.parse(require('fs').readFileSync('$task_file','utf8')); process.stdout.write(JSON.stringify(t.expected||{}))" 2>/dev/null || echo "{}")"

  validation_result="$(node -e "
const fs = require('fs');
const expected = JSON.parse(process.argv[1]);
const files = expected.files_created || [];
const contains = expected.content_contains || [];
let fail = null;

for (const f of files) {
  if (!fs.existsSync(f)) { fail = 'Missing file: ' + f; break; }
  if (!fail && contains.length > 0) {
    const content = fs.readFileSync(f, 'utf8');
    for (const s of contains) {
      if (!content.includes(s)) { fail = 'Missing content: ' + s + ' in ' + f; break; }
    }
  }
}
process.stdout.write(fail ? 'FAIL:' + fail : 'PASS');
" "$files_json" 2>/dev/null || echo "FAIL:validation error")"

  if [[ "$validation_result" == "PASS" ]]; then
    pass=true
    pass_count=$((pass_count + 1))
    echo "  PASS ($duration_ms ms)"
  else
    fail_reason="${validation_result#FAIL:}"
    fail_count=$((fail_count + 1))
    echo "  FAIL: $fail_reason"
  fi

  total=$((total + 1))

  # Escape strings for JSON
  snippet="$(echo "${claude_output:0:200}" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(d.trim())))" 2>/dev/null || echo '""')"
  fail_reason_json="$(echo "$fail_reason" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(d.trim()||null)))" 2>/dev/null || echo 'null')"

  cat >> "$RESULTS_FILE" <<EOF
{"runId":"$RUN_ID","instanceId":"$RUN_ID-$task_id","taskId":"$task_id","category":"$category","difficulty":"$difficulty","startTs":"$start_ts","endTs":"$end_ts","durationMs":$duration_ms,"pass":$pass,"failReason":$fail_reason_json,"outputSnippet":$snippet}
EOF

done

echo ""
echo "=== Summary ==="
echo "  Total : $total"
echo "  Pass  : $pass_count"
echo "  Fail  : $fail_count"
if [[ $total -gt 0 ]]; then
  pct=$(( pass_count * 100 / total ))
  echo "  Rate  : $pct%"
fi
echo "  File  : $RESULTS_FILE"
echo ""

exit 0
