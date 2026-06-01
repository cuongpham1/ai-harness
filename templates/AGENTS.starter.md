# Agent Instructions

Add project-specific instructions for Cursor, Codex, Claude Code, or other coding agents here.

<!-- HARNESS:BEGIN -->
## Harness

This project uses **AI Harness** (hybrid: Claude Code pipeline + durable layer).

Before work, read:

| Doc | Purpose |
|-----|---------|
| [docs/HARNESS.md](docs/HARNESS.md) | Task loop, validation, trace sync |
| [docs/FEATURE_INTAKE.md](docs/FEATURE_INTAKE.md) | tiny / normal / high-risk lanes |
| [docs/CONTEXT_RULES.md](docs/CONTEXT_RULES.md) | Phase-by-lane context rules |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Harness + stack boundaries |
| [.project-manager/README.md](.project-manager/README.md) | Active tasks and pipeline |

Durable records (`scripts/bin/harness-cli`):

```bash
scripts/bin/harness-cli query matrix
scripts/bin/harness-cli intake --type change_request --summary "..." --lane normal
```

**Task file = source of truth.** Structured `### After-Work` in task files syncs to `harness.db` on session end.

## Code change pipeline

```
@coder → @spec-reviewer → @reviewer → @tester → PM marks done
```
<!-- HARNESS:END -->
