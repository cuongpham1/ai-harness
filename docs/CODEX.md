# Codex (OpenAI) and GitHub Copilot with AI Harness

This guide explains how to use the AI Harness from **Codex** (OpenAI) or **GitHub Copilot**
(in VS Code, github.com, or Copilot CLI with a Codex-class model). These agents have no
hook system. Codex reads `AGENTS.md` natively; Copilot loads
[`.github/copilot-instructions.md`](../.github/copilot-instructions.md) for repository-wide
instructions. Both can run shell commands, but neither fires the lifecycle hooks that
Claude Code and Cursor rely on. Everything those hooks do must be done manually.

---

## 1. What works out of the box

| Capability | How |
|------------|-----|
| Agent instructions | Codex: `AGENTS.md` at repo root. Copilot: `.github/copilot-instructions.md` (points to `AGENTS.md` + this guide) |
| Durable CLI | `scripts/bin/harness-cli` runs as a normal shell command |
| Docs | `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/CONTEXT_RULES.md`, etc. are plain markdown |
| Task files | `.project-manager/tasks/*.md` are the source of truth and editable directly |

You can read the matrix, intake work, and record traces exactly like any other agent —
the CLI does not depend on hooks.

---

## 2. What does NOT work

Codex has no equivalent of the Claude Code `.claude/settings.json` hooks. None of these
fire automatically:

| Hook | Normally does | Codex equivalent |
|------|---------------|------------------|
| `SessionStart` | Loads matrix / context at start | Run `harness-cli query matrix` manually |
| `Stop` | Syncs After-Work note → `harness.db` | Run `harness-cli trace` manually |
| `PreToolUse` | Guards / context injection before edits | No equivalent — be deliberate |
| `PostToolUse` | Records file reads / changes | Track files yourself, pass via `--read` / `--changed` |

Cursor's `.cursor/hooks.json` is likewise inert for Codex. The single most important
consequence: **a trace is only recorded if you run `harness-cli trace` yourself.**

---

## 3. Manual workflow (replaces hooks)

### Before work
```bash
scripts/bin/harness-cli query matrix
```
This is what `SessionStart` would have loaded. Then read the relevant task file in
`.project-manager/tasks/` and the docs listed in `AGENTS.md`.

### Do the work
Implement the smallest safe change, following project patterns. Keep a mental (or written)
list of which files you read and which you changed — you will need them for the trace.

### After work — two required steps

**Step 1 — append an After-Work note to the task file** (`.project-manager/tasks/<task-id>.md`):

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

`scripts/sync-harness-trace.mjs` parses the `**Actions:**` and `**Files read:**` fields, so
keep those labels exact.

**Step 2 — record the trace to the durable DB:**

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

Without Step 2 the trace will **not** appear in `harness-cli query traces`. In Claude Code
the `Stop` hook does this for you; in Codex you must do it explicitly.

---

## 4. Trace command reference

```bash
scripts/bin/harness-cli trace [OPTIONS] --summary <SUMMARY>
```

| Flag | Purpose |
|------|---------|
| `--summary` | **Required.** One-sentence description of what was done |
| `--agent` | Agent name — use `codex` |
| `--outcome` | `completed` \| `partial` \| `blocked` \| `failed` |
| `--actions` | Comma-separated steps taken (needed for `standard` tier) |
| `--read` | Comma-separated files read (needed for `standard` tier) |
| `--changed` | Comma-separated files changed (needed for `standard` tier) |
| `--errors` | Errors encountered, or `none` |
| `--duration` | Seconds elapsed for the task |
| `--intake` | Link to an intake id, if any |
| `--story` | Link to a story / task id, if any |
| `--tokens` | Token count, if tracked |
| `--friction` | Friction notes, or `none` |
| `--decisions` | Key decisions made (needed for `detailed` tier) |
| `--notes` | Free-form notes |

---

## 5. After-Work format (all fields)

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
**Decisions:** key decisions (optional, raises trace to detailed tier)
**Risks/Blockers:** anything follow-up agents should know
```

---

## 6. Codex cloud mode

`harness.db` is a **local** SQLite database. A trace recorded with `harness-cli trace`
during a Codex cloud task is written to that local DB. It persists across sessions **only
if the database (or the change that created it) is committed or otherwise synced back** to
the repo. If the cloud workspace is ephemeral and not committed, the trace is lost when the
workspace is torn down. When in doubt, commit the DB change (or the task-file After-Work
note, which can be re-synced) before the workspace ends.

---

## 7. Score tiers

The richness of a trace determines its tier. Aim for at least `standard` on normal-lane work.

| Tier | Requires |
|------|----------|
| `minimal` | `--outcome` only |
| `standard` | `--outcome` + `--actions` + `--read` + `--changed` + `--errors` |
| `detailed` | everything in `standard` + `--decisions` |

Populate `--actions` and `--read` (and the matching After-Work fields) to reach `standard`.
