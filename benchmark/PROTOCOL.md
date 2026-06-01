# Harness Benchmark Protocol (H3)

Reference: [docs/HARNESS_MATURITY.md](../docs/HARNESS_MATURITY.md) level **H3**.

## Purpose

Measure harness compliance and attribute improvements/regressions to Runtime Substrate
responsibilities from [docs/HARNESS_COMPONENTS.md](../docs/HARNESS_COMPONENTS.md).

## Metrics

| Metric | Target (H3) | Source |
|--------|-------------|--------|
| `harness_compliance_pct` | 85–95% | Pass rate on `harness-*` deterministic tasks |
| `trace_quality_avg` | 2.3–2.7 / 3 | `harnessMetrics.traceTier` from harness-03-score |
| `friction_captured_pct` | High on tasks with friction | harness-04-friction |
| `responsibility_deltas` | Per-component improved/regressed | `benchmark/compare.mjs` |

## Run harness benchmark (no live agent required)

```bash
bash benchmark/run-harness.sh
```

Results: `benchmark/results/YYYY-MM-DD-HH-MM-harness.jsonl`

## Baseline

```bash
cp benchmark/results/LATEST-harness.jsonl benchmark/results/baseline-h3.jsonl
```

Committed baseline: [benchmark/results/baseline-h3.jsonl](results/baseline-h3.jsonl)

## Compare runs

```bash
node benchmark/compare.mjs \
  benchmark/results/baseline-h3.jsonl \
  benchmark/results/CURRENT-harness.jsonl
```

Output includes pass-rate delta and **responsibility attribution** table.

## Harness tasks

| ID | Checks | Responsibility |
|----|--------|----------------|
| harness-01-handoff | stop-handoff blocks missing After-Work | task_state |
| harness-02-sync | After-Work syncs to harness.db | task_state |
| harness-03-score | score-trace meets lane tier | observability |
| harness-04-friction | friction-by-component groups tags | failure_attribution |
| harness-05-backlog | backlog predicted/outcome loop | entropy_auditing |

## Agent tasks (optional)

Legacy code-generation tasks in `benchmark/tasks/sample-*.json` require a live
Claude/Cursor agent. Use `benchmark/run.sh` when agent CLI is configured.

## Backlog outcome loop demo

Before a harness change:

```bash
scripts/bin/harness-cli backlog add \
  --title "H3 benchmark attribution" \
  --pain "No component-level compare" \
  --predicted "harness_compliance measurable; friction grouped by component"
```

After compare shows improvement:

```bash
scripts/bin/harness-cli backlog close --id N \
  --outcome "compliance X%→Y%; observability +1 task pass"
```
