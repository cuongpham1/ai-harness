<!-- HARNESS:BEGIN -->
## Harness

This project uses **AI Harness** (hybrid: Claude Code **or Cursor** pipeline + durable layer).

Before work, read:

| Doc | Purpose |
|-----|---------|
| [docs/HARNESS.md](docs/HARNESS.md) | Task loop, validation, trace sync |
| [docs/FEATURE_INTAKE.md](docs/FEATURE_INTAKE.md) | tiny / normal / high-risk lanes |
| [docs/CONTEXT_RULES.md](docs/CONTEXT_RULES.md) | Phase-by-lane context rules |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Harness + stack boundaries |
| [docs/FRICTION_REVIEW.md](docs/FRICTION_REVIEW.md) | Friction review + component map |
| [.project-manager/README.md](.project-manager/README.md) | Active tasks and pipeline |

Durable records (`scripts/bin/harness-cli`):

```bash
scripts/bin/harness-cli query matrix
scripts/bin/harness-cli intake --type change_request --summary "..." --lane normal
scripts/bin/harness-cli trace --summary "..." --outcome completed
```

**Task file = source of truth.** Append structured `### After-Work` to `.project-manager/tasks/*.md`; Stop hooks sync trace + story to `harness.db` and run lane-aware verification.

## Agent done checklist (H3/H4)

| Lane | Before you stop |
|------|-----------------|
| **tiny** | `### After-Work` with **Done** (≥10 chars), **Outcome**, **Friction** |
| **normal** | Above + full pipeline (coder → spec-reviewer → reviewer → tester); `Outcome: completed` triggers `verify-story` lint/test |
| **high-risk** | Above + ADR in `docs/decisions/`; decision verify via harness-cli when applicable |

Manual proof: `bash scripts/verify-story.sh` · Full gate: `bash scripts/verify-h4.sh` · See [docs/HARNESS_VERIFICATION.md](docs/HARNESS_VERIFICATION.md).

## Code change pipeline

```
@coder → @spec-reviewer → @reviewer → @tester → PM marks done
```

Skip full pipeline only for **tiny** lane. Details: `.claude/agents/pm.md`.

## Token efficiency

- **RTK:** `rtk git …`, `rtk grep …`, or `bash scripts/rtk-shell.sh …` when RTK installed; stack: `scripts/rtk-node.sh`, `scripts/rtk-python.sh`, `scripts/rtk-flutter.sh`
- **MCP:** optional context7 + gitnexus — see [docs/MCP_SETUP.md](docs/MCP_SETUP.md) (configure separately for Cursor and Claude)
- **Lanes:** tiny = minimal pipeline; use [docs/TOKEN_EFFICIENCY.md](docs/TOKEN_EFFICIENCY.md)

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
