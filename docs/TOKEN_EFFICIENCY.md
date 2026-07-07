# Token Efficiency

Ways to reduce tokens and latency when using AI Harness. Goal: **less noise in context**, not weaker process.

## Biggest wins (do these first)

| Priority | Action | Saves |
|----------|--------|-------|
| 1 | Classify **tiny** lane → skip full subagent pipeline | Whole extra agent runs |
| 2 | Follow [CONTEXT_RULES.md](CONTEXT_RULES.md) phase/lane — read less | Input tokens |
| 3 | Use **RTK** for shell + stack test wrappers | Tool output tokens |
| 4 | Run `/compact` at phase boundaries (hook reminds at ~50 calls) | History tokens |
| 5 | MCP on-demand ([MCP_SETUP.md](MCP_SETUP.md)) — context7, gitnexus | Fewer file reads |

## RTK (Reduced Tool output Kit)

### Shell: `rtk` CLI

Install [RTK](https://github.com/rtk-ai/rtk) (or your team’s build). Prefix high-volume commands:

```bash
rtk git status
rtk git diff
rtk git log --oneline -20
rtk grep -r "pattern" src/
rtk find . -name "*.ts"
```

Agents should prefer `rtk` over raw `git`/`grep`/`find` when RTK is on PATH (~60–80% smaller stdout).

Helper (falls back if RTK missing):

```bash
bash scripts/rtk-shell.sh git status
```

### Stack wrappers (installed with framework)

| Script | Framework | Command |
|--------|-----------|---------|
| `scripts/rtk-flutter.sh` | flutter | `test`, `analyze`, `pub`, `gen-l10n` |
| `scripts/rtk-node.sh` | nodejs, react, nextjs | `npm test`, `npm run lint` |
| `scripts/rtk-python.sh` | python | `pytest`, `ruff check` |

Example:

```bash
bash scripts/rtk-node.sh test
bash scripts/rtk-python.sh test -q
bash scripts/rtk-flutter.sh test
```

Update stack docs (`docs/*_STACK.md`) to reference these in Validation sections.

## Caveman mode

Subagents already respond in **caveman mode** (terse prose). For main chat:

- `/caveman lite` — drop filler, keep grammar
- `/caveman` — full terse mode
- `stop caveman` — revert

Good for: status, reviews, exploration summaries.  
Avoid for: high-risk specs, legal/compliance text, After-Work handoff (keep clear).

## Session inject (lighter default)

`sessionStart` injects **in_progress + blocked** tasks first. Todo list is omitted when something is in progress (max 3 otherwise). Reduces repeated context each session.

## Compact threshold

Claude hook `suggest-compact.js` warns after `COMPACT_THRESHOLD` tool calls (default **50**):

```bash
export COMPACT_THRESHOLD=40   # earlier nudge in long sessions
```

Compact **after** milestones (explore → implement), not mid-edit.

## Pipeline by lane

| Lane | Subagents | MCP | RTK |
|------|-----------|-----|-----|
| **tiny** | coder only (optional tester) | skip unless stuck | optional |
| **normal** | coder → spec-reviewer → reviewer → tester | context7 for new libs | recommended |
| **high-risk** | full pipeline + solution-architect | context7 + gitnexus | required for test/lint |

## Cursor-specific

- Disable **Third-party skills** if using `.cursor/hooks.json` only (avoids duplicate Claude hooks).
- Keep `.cursor/rules/*.mdc` focused — long rules cost tokens every turn.

## Measuring

Harness has built-in token observability via CLI:

- `scripts/bin/harness-cli query stats` for repo-level token coverage and missing-token explanations.
- `scripts/bin/harness-cli query cost` for agent/lane token coverage, unresolved gaps, and USD estimate.

Optional extra:

- Caveman `/caveman-stats` (Claude Code plugin) for session estimates
- Compare trace size / session length before vs after RTK + tiny lane discipline
