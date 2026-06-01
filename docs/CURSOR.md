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
| Audit file edits | `postToolUse` | `cursor/post-tool-use.mjs` |
| Subagent telemetry | `subagentStart/Stop` | `cursor/subagent-telemetry.mjs` |
| Block missing After-Work | `stop` | `cursor/stop-handoff.mjs` |
| Sync trace → harness.db | `stop` | `cursor/stop-sync-trace.mjs` |
| Score trace quality | `stop` | `cursor/stop-score-trace.mjs` |
| Session checkpoint | `stop` | `cursor/stop-checkpoint.mjs` |

## Verify hooks

1. Open **Cursor Settings → Hooks** (or Hooks output channel)
2. Save `.cursor/hooks.json` — Cursor reloads on save
3. Restart Cursor if hooks do not appear
4. Start an Agent session — `sessionStart` should inject `.project-manager` state

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
```
