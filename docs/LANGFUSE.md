# Langfuse Integration (Optional)

Use Langfuse for production observability and token/cost analytics while keeping
Harness governance flow unchanged.

## What This Adds

- Stop-hook export of new `trace` rows to Langfuse ingestion API.
- External correlation fields on `trace` (`langfuse_trace_id`, `langfuse_exported_at`).
- Non-blocking behavior: export failures never block normal Harness completion.

## Enable

Set environment variables in the project running Harness:

```bash
export HARNESS_LANGFUSE_ENABLED=1
export HARNESS_LANGFUSE_HOST="https://jp.cloud.langfuse.com"   # optional
export HARNESS_LANGFUSE_PUBLIC_KEY="pk-lf-2990a5e5-b611-4155-b356-0accf014cd03"
export HARNESS_LANGFUSE_SECRET_KEY="sk-lf-370db411-9949-464a-92f0-2dafd47f7123"
```

When enabled, Stop hook `scripts/hooks/export-langfuse-trace.mjs` runs after
trace sync.

## Export Behavior

- Source table: `trace` (joined with `intake.risk_lane`).
- Incremental export by `id` using state file:
  - `kg/runtime/langfuse-export-state.json`
- Event mapping:
  - `trace-create` for each Harness trace
  - `generation-create` with `usage.totalTokens` when `token_estimate` exists

## Schema

Migration `scripts/schema/007-langfuse-export.sql` adds:

- `trace.langfuse_trace_id`
- `trace.langfuse_exported_at`

Apply with:

```bash
scripts/bin/harness-cli migrate
```

## Coverage Metrics

After migration 007, CLI reports Langfuse export coverage:

```bash
scripts/bin/harness-cli query stats   # repo-level exported_lf / pending_export
scripts/bin/harness-cli query cost    # agent/lane export coverage + token cost
```

## Failure Mode

Exporter is best-effort and never blocks Stop hook.

- Missing env keys: exporter skips.
- API/network failure: exporter logs to stderr and keeps progress state up to
  latest successful trace.

## Security Notes

- Keep Langfuse keys in local env or secret manager; never commit to git.
- Do not put keys in task files, docs, or trace notes.
