# task-codegraph-001: CodeGraph MCP Integration

**Status:** done
**Lane:** normal
**Priority:** high
**Created:** 2026-06-04

## Goal
Integrate CodeGraph MCP server into harness to reduce agent tool calls by ~58% and tokens by ~47%.

## Acceptance Criteria
- [ ] `.claude/settings.json` has `mcpServers.codegraph` configured (npx @colbymchenry/codegraph)
- [ ] New hook `scripts/hooks/pre-agent-codegraph.mjs` appends CodeGraph usage instructions to Agent PreToolUse for coder/explorer/spec-reviewer/reviewer agents
- [ ] Agent definitions (coder.md, explorer.md) reference CodeGraph tools in their instruction body
- [ ] `docs/MCP_SETUP.md` documents CodeGraph setup, available tools, and staleness behavior
- [ ] Cursor parity: `.cursor/hooks.json` updated if needed

## Context
CodeGraph (github.com/colbymchenry/codegraph) is an MCP server that pre-indexes codebase into SQLite via tree-sitter. Exposes: codegraph_explore, codegraph_search, codegraph_callers, codegraph_callees, codegraph_impact, codegraph_node, codegraph_files, codegraph_status.

Key behaviors:
- `codegraph_impact` — blast radius analysis before edits (transitive caller/import traversal)
- Staleness banner in MCP response warns agent when index is stale (use Read directly)
- Self-delivered usage guide via MCP initialize response

Install: `npx -y @colbymchenry/codegraph` (v0.9.9 confirmed on npm)

## Notes

### After-Work — 2026-06-04
**Agent:** coder
**Outcome:** completed
**Done:** Added CodeGraph MCP server config via `.mcp.json`, wired a PreToolUse hook that appends CodeGraph reminders to coder/reviewer/explorer/spec-reviewer agent prompts, updated coder.md and explorer.md with CodeGraph tool guidance, and expanded docs/MCP_SETUP.md with full CodeGraph documentation.
**Files changed:** .mcp.json (new), scripts/hooks/pre-agent-codegraph.mjs (new), .claude/settings.json, .claude/agents/coder.md, .claude/agents/explorer.md, docs/MCP_SETUP.md, .cursor/hooks.json
**Errors:** none — the `mcpServers` key is rejected by Claude Code's settings.json schema validator, so MCP config was placed in `.mcp.json` (the correct project-level location per Claude Code docs)
**Friction:** Claude Code settings.json schema validation blocks `mcpServers` as a top-level key; used `.mcp.json` at project root instead, which is the correct Claude Code convention.
**Decisions:** Used `.mcp.json` for MCP server config instead of `settings.json`; hook outputs `{"decision":"continue","modifiedInput":{...}}` format matching Claude Code PreToolUse hook contract; Cursor hook wired with `failClosed: false` so a hook error doesn't block agent dispatch.
**Risks/Blockers:** CodeGraph index must be initialized with `npx @colbymchenry/codegraph init` before tools are useful — documented in MCP_SETUP.md.

## Notes

### After-Work (fix) — 2026-06-04
**Agent:** coder
**Outcome:** completed
**Done:** Fixed BLOCKER prompt-text fallback injection in isCodeTouchingAgent (removed prompt scan, agent_name only); fixed stdin race condition in readStdin (reject-on-timeout instead of resolve-on-timeout); pinned codegraph to @colbymchenry/codegraph@0.9.9 in .mcp.json.
**Files changed:** scripts/hooks/pre-agent-codegraph.mjs, .mcp.json
**Errors:** none
**Decisions:** readStdin now rejects on timeout — the existing `main().catch(() => process.exit(0))` handler provides correct fail-open behavior.
