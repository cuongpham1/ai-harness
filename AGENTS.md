# Agent Instructions

**AI Harness installer repository** — source template for `bash install.sh /path/to/project`.

Target projects receive merged `AGENTS.md` from `templates/AGENTS.starter.md` + harness block. Do not copy this file verbatim to targets.

<!-- HARNESS:BEGIN -->
## Harness (installer repo)

| Doc | Purpose |
|-----|---------|
| [docs/HARNESS.md](docs/HARNESS.md) | Hybrid model, unified trace sync |
| [docs/FEATURE_INTAKE.md](docs/FEATURE_INTAKE.md) | Risk lanes |
| [frameworks/](frameworks/) | 12 stack profiles |
| [install.sh](install.sh) | Target project installer |

```bash
bash install.sh --yes --framework nodejs --name "My API" /path/to/project
scripts/bin/harness-cli query stats
bash scripts/verify-story.sh          # H4 lane-aware proof
bash scripts/verify-h4.sh             # H3 + parity + H4 dry-run
```

**Done checklist:** tiny → After-Work only; normal → full pipeline + `verify-story` on completed; high-risk → + ADR. See [docs/HARNESS_VERIFICATION.md](docs/HARNESS_VERIFICATION.md).

## Codex and hook-less agents

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

## Agent roster

See `.claude/agents/` — generic agents; stack rules come from `frameworks/<id>/` at install time.
