# Phase 4 — H4 Full Batch Proof

Status: **Implemented**
Target: H4 full (Automated Verification)

## Criteria

Per `docs/HARNESS_MATURITY.md` H4:
- [x] Lane-aware verification command for selected story — `verify-story.sh`
- [x] Story proof columns updated from command output — `sync-harness-story.mjs`
- [x] Decision verification commands run in batch — `batch-verify.sh --decisions`
- [x] Missing validation evidence surfaced before task marked implemented — `run-harness-verify.mjs`
- [x] Batch story verification — `batch-verify.sh --stories`
- [x] Backlog integration in hooks — `backlog-surface.mjs`

## Components

| Component | Purpose |
|-----------|---------|
| `scripts/batch-verify.sh` | Batch all stories + decisions; surfaces missing proof |
| `scripts/hooks/backlog-surface.mjs` | Stop hook — surfaces open backlog items |
| `scripts/verify-h4.sh` | H4 maturity verification (runs batch-verify + H3 baseline) |
| `scripts/hooks/run-harness-verify.mjs` | Stop hook — single active task verification |
| `scripts/hooks/sync-harness-story.mjs` | Stop hook — syncs task status to story rows |

## Usage

```bash
# Batch verify all stories + decisions
bash scripts/batch-verify.sh

# Stories only
bash scripts/batch-verify.sh --stories

# Decisions only
bash scripts/batch-verify.sh --decisions

# Open stories only (non-implemented)
bash scripts/batch-verify.sh --open

# Dry-run (no execution)
bash scripts/batch-verify.sh --dry-run

# Full H4 verification
bash scripts/verify-h4.sh
```

## Backlog integration

Open backlog items surface automatically at session end (10-min debounce).
Session start shows open backlog count.

Manual query:
```bash
scripts/bin/harness-cli query backlog --open
scripts/bin/harness-cli query backlog --closed
```

## H4 to H5 gap

H5 requires a self-improvement protocol: harness automatically proposes backlog items from friction, batch-verifies after changes, and evolves its own policy. Not yet implemented.
