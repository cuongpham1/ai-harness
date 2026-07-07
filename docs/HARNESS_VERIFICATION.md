# Harness Verification (H4)

Lane-aware proof checks so agents cannot mark work **completed** without stack evidence.

## Commands

**Installer / hybrid (Stop hooks):**

```bash
# Active task — run lint/test from framework profile (or Cargo.toml fallback)
bash scripts/verify-story.sh

# Specific task
bash scripts/verify-story.sh --task task-042

# CI / config check only (no test execution)
bash scripts/verify-story.sh --dry-run

# Full H4 gate (H3 + parity + dry-run)
bash scripts/verify-h4.sh
```

**Durable layer (upstream Phase 4, CLI 0.1.11+):**

```bash
scripts/bin/harness-cli migrate
scripts/bin/harness-cli story add --id US-001 --title "..." --lane normal --verify "npm test"
scripts/bin/harness-cli story verify US-001
```

Use `--unit 1` / `--integration 1` on `story update` (numeric flags, not `yes`/`no`). See [repository-harness harness-cli-v0.1.11](https://github.com/hoangnb24/repository-harness/releases/tag/harness-cli-v0.1.11).

## Lane behavior

| Lane | Stack lint/test | Story DB update |
|------|-----------------|-----------------|
| tiny | Skipped | Sync only (Stop hook) |
| normal | Only when `Outcome: completed` (missing/other → skip) | `--unit 1` / `--integration 1` when lint/test pass; optional per-task `**Verify lint:**` / `**Verify test:**` for monorepos |
| high-risk | Same + `decision verify` batch | Same |

## Stop hook chain

After handoff, trace sync, and score-trace:

1. `run-harness-verify.mjs` — calls `verify-story.sh` only when **Outcome: completed** (deduped per After-Work)
2. `sync-harness-story.mjs` — task **Story ID** / **Status** → `harness-cli story` (`implemented` only if verify-last.json passed)

Set `HARNESS_VERIFY_BLOCK=0` to warn without blocking (exit 2).

## Proof report

- `kg/runtime/verify-last.json` — last verify outcome
- **`proof: true`** only after stack lint/test pass (or tiny lane with `Outcome: completed`)
- Skip/stale reports use **`proof: false`** — `sync-harness-story` will not promote to `implemented`
- `run-harness-verify` invalidates the report when latest After-Work is not `completed`
- `harness-cli story update --evidence "verify-story …"` when story exists in DB

## Framework commands

Read `.harness-profile` → `frameworks/<id>/profile.json` fields `lint_cmd`, `test_cmd`.

Installer repo without profile uses `cargo fmt --check` + `cargo test` when `Cargo.toml` exists.
