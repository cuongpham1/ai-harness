# Benchmark System

Track harness quality over time by running repeatable AI tasks and recording results.

---

## Purpose

- Detect regressions when hooks or agent prompts change
- Compare performance across harness versions
- Identify task categories where agents consistently succeed or fail

---

## Task Format

Tasks live in `benchmark/tasks/*.json`. Schema:

```json
{
  "id": "string — unique task identifier",
  "category": "string — e.g. code-generation, refactor, analysis",
  "difficulty": "easy | medium | hard",
  "prompt": "string — the prompt sent to Claude",
  "expected": {
    "files_created": ["list of file paths that must exist after task"],
    "content_contains": ["list of strings that must appear in created files"]
  },
  "timeout_seconds": 60,
  "tags": ["array of string tags"]
}
```

All fields are required except `tags`.

---

## How to Run

```bash
bash benchmark/run.sh
```

Results written to `benchmark/results/YYYY-MM-DD-HH-MM.jsonl`.

To run against a specific tasks dir:

```bash
TASKS_DIR=benchmark/tasks bash benchmark/run.sh
```

---

## How to Add Tasks

1. Create `benchmark/tasks/<id>.json` following the schema above.
2. Choose a unique `id` (e.g. `gen-02`, `refactor-01`).
3. Set realistic `timeout_seconds` (60–300 for most tasks).
4. Add `expected.files_created` and `expected.content_contains` checks for automated pass/fail.

---

## Results Format

Each results file is JSONL, one object per task:

```json
{
  "taskId": "sample-01",
  "category": "code-generation",
  "difficulty": "easy",
  "startTs": "2026-05-29T10:00:00.000Z",
  "endTs": "2026-05-29T10:00:45.123Z",
  "durationMs": 45123,
  "pass": true,
  "failReason": null,
  "outputSnippet": "first 200 chars of claude output"
}
```

---

## How to Compare Runs

```bash
# List result files
ls benchmark/results/

# Diff two runs (pass rates)
node -e "
const fs = require('fs');
const [a, b] = process.argv.slice(2).map(f =>
  fs.readFileSync(f,'utf8').trim().split('\n').map(JSON.parse)
);
const rate = arr => (arr.filter(r=>r.pass).length / arr.length * 100).toFixed(1);
console.log('Run A pass rate:', rate(a) + '%');
console.log('Run B pass rate:', rate(b) + '%');
" benchmark/results/RUN_A.jsonl benchmark/results/RUN_B.jsonl
```

---

## Notes

- `benchmark/results/` is git-ignored — results are local only.
- The actual Claude CLI invocation in `run.sh` is marked with a `TODO` comment — adjust for your environment.
