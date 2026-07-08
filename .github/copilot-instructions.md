# GitHub Copilot + Codex — AI Harness

This repository uses **AI Harness**. Copilot and Codex have **no lifecycle hooks** — automation from Claude Code / Cursor does not run here. Follow the manual workflow in `docs/CODEX.md`.

## Read first

| File | Purpose |
|------|---------|
| [AGENTS.md](../AGENTS.md) | Harness rules, lanes, pipeline, After-Work format |
| [docs/CODEX.md](../docs/CODEX.md) | Full Copilot/Codex guide — what works, manual trace workflow |
| [.project-manager/README.md](../.project-manager/README.md) | Active and completed tasks |
| `.project-manager/tasks/<task-id>.md` | Source of truth for the story you are working |

Also read docs listed in `AGENTS.md` for your lane: `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/CONTEXT_RULES.md`.

## Before every task

```bash
scripts/bin/harness-cli query matrix
```

Open the task file, confirm scope and acceptance criteria, then implement the smallest safe change.

## After every task (required)

Hooks will **not** sync traces. Complete **both** steps:

1. Append a `### After-Work` note to the task file (`**Agent:** codex` or `copilot`).
2. Run `scripts/bin/harness-cli trace --agent codex ...` — see `docs/CODEX.md` for all flags.

Without step 2, the trace will not appear in `harness-cli query traces`.

## Verify before marking done

```bash
bash scripts/verify-story.sh
```

Set `**Status:** done` on the task only after verify passes (`kg/runtime/verify-last.json` → `proof: true`).

## What does not run automatically

SessionStart context, Stop trace sync, handoff gates, subagent pipeline, and context nudge — all **manual** on Copilot. See `docs/CODEX.md` §2.
