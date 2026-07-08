# Agent Instructions

Add project-specific instructions for Cursor, Codex, Claude Code, or other coding agents here.

GitHub Copilot loads [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for repo-wide harness rules; see [docs/CODEX.md](docs/CODEX.md) for the manual workflow.

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

## Codex and hook-less agents

GitHub Copilot reads [`.github/copilot-instructions.md`](.github/copilot-instructions.md); full guide: [docs/CODEX.md](docs/CODEX.md).

If you are **Codex** (OpenAI) or any agent without a hook system, run these manually — hooks won't fire automatically.

**Before work:**
```bash
scripts/bin/harness-cli query matrix
```

**After work — two steps (both required):**

Step 1 — append After-Work note to the task file in `.project-manager/tasks/`:
```markdown
### After-Work — YYYY-MM-DD
**Agent:** codex
**Outcome:** completed | partial | blocked | failed
**Done:** one sentence summary (≥10 chars)
**Actions:** comma-separated list of actions taken
**Files read:** comma-separated list of files read
**Files changed:** comma-separated list
**Errors:** none
**Friction:** none
```

Step 2 — record trace to durable DB:
```bash
scripts/bin/harness-cli trace \
  --summary "one sentence summary" \
  --agent codex \
  --outcome completed \
  --actions "read AGENTS.md, edited src/main.ts, ran tests" \
  --read "AGENTS.md,docs/HARNESS.md" \
  --changed "src/main.ts" \
  --errors "none" \
  --duration 300
```

Without Step 2 the trace won't appear in `harness-cli query traces` — Claude Code hooks normally do this on Stop.
<!-- HARNESS:END -->
