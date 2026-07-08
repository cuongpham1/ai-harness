# Cursor Setup

Full AI Harness parity on **Cursor** (hooks + subagents + durable layer).

Claude Code uses `.claude/settings.json`. Cursor uses `.cursor/hooks.json` + `.cursor/rules/` + `.cursor/agents/`.

## Install

Included automatically when you run:

```bash
bash install.sh --yes --framework <id> --name "My Project" /path/to/project
```

Or add Cursor layer to an existing harness project:

```bash
bash scripts/install-cursor-layer.sh /path/to/project
```

Requires **Node.js 18+** (hooks run via `node`).

**MCP:** Cursor reads `~/.cursor/mcp.json` only — not Claude. Sync both tools per [MCP_SETUP.md](../docs/MCP_SETUP.md). **Token tips:** [TOKEN_EFFICIENCY.md](../docs/TOKEN_EFFICIENCY.md).

## What gets installed

| Path | Purpose |
|------|---------|
| `.cursor/hooks.json` | Cursor hook wiring |
| `scripts/hooks/cursor/*.mjs` | Adapters → shared harness hooks |
| `.cursor/rules/*.mdc` | Always-on harness policy |
| `.cursor/agents/*.md` | Subagents synced from `.claude/agents/` |

## Hook mapping (Claude Code → Cursor)

| Harness behavior | Cursor event | Script |
|------------------|--------------|--------|
| Inject task state | `sessionStart` | `cursor/session-start.mjs` |
| Block dangerous shell | `beforeShellExecution` | `cursor/before-shell.mjs` |
| Secret / .env guard | `preToolUse` (Write/Edit) | `cursor/pre-tool-content-guard.mjs` |
| Warn on high context usage (no block) | `preToolUse` | `cursor/context-nudge.mjs` |
| Audit file edits | `postToolUse` | `cursor/post-tool-use.mjs` |
| Subagent telemetry | `subagentStart/Stop` | `cursor/subagent-telemetry.mjs` |
| Block missing After-Work | `stop` | `cursor/stop-handoff.mjs` |
| Sync trace → harness.db | `stop` | `cursor/stop-sync-trace.mjs` |
| Langfuse export (optional) | `stop` | `cursor/stop-export-langfuse.mjs` |
| Score trace quality | `stop` | `cursor/stop-score-trace.mjs` |
| Session checkpoint | `stop` | `cursor/stop-checkpoint.mjs` |

## Context handoff (Cursor has no `/compact`)

Claude Code exposes `/compact` to shrink history mid-session. **Cursor does not.**

When `context-nudge.mjs` warns (Hooks output channel):

1. Finish the current micro-step
2. Append `### After-Work` to touched task files
3. **Start a new Agent chat** — `sessionStart` reloads `.project-manager` state and `kg/runtime/checkpoint.md`

The hook is **warn-only** — it never blocks tool calls (blocking without a recovery command would deadlock the session).

## Verify hooks

1. Open **Cursor Settings → Hooks** (or Hooks output channel)
2. Save `.cursor/hooks.json` — Cursor reloads on save
3. Restart Cursor if hooks do not appear
4. Start an Agent session — `sessionStart` should inject `.project-manager` state
5. High context usage should show warnings in Hooks output channel; tool calls stay allowed

## Subagent pipeline

Same as Claude Code:

```text
pm → coder → spec-reviewer → reviewer → tester
```

Invoke in Agent chat:

```text
Use the coder subagent to implement task-001 per .project-manager/tasks/task-001.md
```

Subagent definitions: `.cursor/agents/`.

## Differences from Claude Code

| Feature | Claude Code | Cursor |
|---------|-------------|--------|
| HUD status line | ✅ `scripts/hud/` | ❌ Not available |
| Hook format | `.claude/settings.json` | `.cursor/hooks.json` |
| Default agent | `pm` in settings | Use rules + delegate to `pm` subagent |
| Context shrink | `/compact` + `suggest-compact.js` | New Agent chat + `context-nudge.mjs` (warn-only) |
| Git commit subagent block | `agent_info.is_subagent` | `beforeShellExecution` asks permission |

## Troubleshooting

### "Invalid hooks.json found claude-project config"

Cursor loads **both** `.cursor/hooks.json` (native) and `.claude/settings.json` (third-party Claude Code hooks). Common causes:

1. **Unsupported hook in `.claude/settings.json`** — Cursor does not support Claude's `SubagentStart`. This repo uses `PreToolUse` + `Task` matcher instead; subagent start telemetry for Cursor runs via `.cursor/hooks.json` → `subagentStart`.
2. **Invalid `.cursor/hooks.json` schema** — Project hooks require top-level `"version": 1`. Use tool matchers like `Write`, not `Edit|ApplyPatch`.
3. **Duplicate hooks** — If you only use Cursor, disable **Settings → Features → Third-party skills** so Cursor ignores `.claude/settings.json` hooks (Claude Code-only).

Reload: save `hooks.json` or restart Cursor. Check **Settings → Hooks** and the **Hooks** output channel.

- **Hooks not firing:** Check Node on PATH; run hook manually: `echo '{}' | node scripts/hooks/cursor/session-start.mjs`
- **Stop loop:** `stop-handoff` returns `followup_message` until After-Work exists (max 3 loops)
- **No trace in DB:** Ensure After-Work has `**Done:**` ≥10 chars and `scripts/bin/harness-cli` exists

## Upgrade

```bash
bash scripts/upgrade.sh /path/to/project
bash scripts/install-cursor-layer.sh /path/to/project
bash scripts/sync-harness-layer.sh /path/to/project   # solo-dev: refresh hooks without touching .gitignore
```
