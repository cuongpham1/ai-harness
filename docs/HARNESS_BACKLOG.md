# Harness Backlog

Accumulated friction and harness improvement ideas. Prefer durable records:

```bash
scripts/bin/harness-cli backlog add --title "short name" --pain "what was hard" --predicted "expected improvement"
scripts/bin/harness-cli backlog close --id N --outcome "measured result"
scripts/bin/harness-cli query backlog --open
scripts/bin/harness-cli query backlog --closed
```

Full review protocol: [FRICTION_REVIEW.md](FRICTION_REVIEW.md).

## Open items

| ID | Found | Friction | Proposed fix | Status |
|----|-------|----------|--------------|--------|
| — | — | Add rows when friction is found | — | — |

## Closed items

| ID | Closed | Resolution |
|----|--------|------------|
| — | — | — |

## Friction tags

Map to [HARNESS_COMPONENTS.md](HARNESS_COMPONENTS.md) responsibilities (see [FRICTION_REVIEW.md](FRICTION_REVIEW.md)):

- `docs-stale` — context selection: doc wrong or missing
- `context-bloat` — context selection: agent read too much or wrong files
- `hook-gap` — observability: automation missing or broken
- `proof-gap` — verification: validation unclear or missing
- `dual-track` — task state: task file and CLI story out of sync
- `tool-gap` — tool access: CLI or command missing
- `perm-gap` — permissions: policy not enforced
- `memory-gap` — project memory: decisions or traces not findable
