# MCP Setup (Cursor + Claude Code)

MCP configs are **per tool**. Cursor does not share MCP with Claude Code automatically.

## Config locations

| Tool | User-level | Project-level |
|------|------------|---------------|
| **Cursor** | `~/.cursor/mcp.json` | `.cursor/mcp.json` (optional) |
| **Claude Code** | `~/.claude/mcp.json` or `.mcp.json` | `.mcp.json` (project root) |

Harness installer does **not** copy your personal MCP config. Add servers manually or via team docs.

## CodeGraph — Harness-bundled MCP server

CodeGraph (`@colbymchenry/codegraph`) is pre-configured in this harness via `.mcp.json` at the project root. It pre-indexes the codebase into a SQLite knowledge graph using tree-sitter, providing fast symbol and call-graph navigation without repeated grep+read chains.

**Performance benefit:** ~58% fewer tool calls, ~47% fewer tokens for code exploration tasks.

### Initialize the index

Run once per project (and after large refactors):

```bash
npx @colbymchenry/codegraph init
```

This creates a `.codegraph/` directory at the project root with the SQLite index.

### Available tools

| Tool | Description | When to use |
|------|-------------|-------------|
| `codegraph_explore` | Look up symbol/function by name | Replace multi-file grep+read for "where is X defined?" |
| `codegraph_search` | Full-text search with structural context | Broad keyword search across indexed files |
| `codegraph_callers` | Find all callers of a function | "What calls X?" — replaces grep for call sites |
| `codegraph_callees` | Find all functions called by X | "What does X call?" — dependency mapping |
| `codegraph_impact` | Transitive blast radius analysis | Run before editing a function with many dependents |
| `codegraph_node` | Detailed info on a single node | Type, location, docstring for a specific symbol |
| `codegraph_files` | List indexed files by pattern | Discover which files are in the graph |
| `codegraph_status` | Check index freshness | Verify index is up to date before relying on results |

### Staleness behavior

When the index is stale (files modified since last `init`), CodeGraph returns a staleness warning banner in the result. When you see this banner:

1. Fall back to direct `Read`/`Grep` for affected files.
2. Re-run `npx @colbymchenry/codegraph init` to rebuild the index.

### Usage patterns

**Before editing a widely-used function:**
```
codegraph_impact(symbol="myFunction") → see blast radius → decide scope of change
```

**Finding where a symbol is defined:**
```
codegraph_explore(name="AuthService") → get file + line → Read only that file
```

**Mapping a call chain:**
```
codegraph_callers(name="saveUser") → list of callers
codegraph_callees(name="saveUser") → list of dependencies
```

## Recommended servers (token-efficient)

| Server | Purpose | Token impact |
|--------|---------|--------------|
| **codegraph** | Code graph / symbol navigation (bundled) | ~58% fewer tool calls, ~47% fewer tokens |
| **context7** | Fetch library docs on demand | Saves vs reading full docs / long web fetch |
| **exa** | Web search | Use sparingly — results enter context |
| **deepwiki** | Repo/wiki Q&A | Use for targeted questions only |

All optional (`required: false` in framework profiles).

## Cursor example (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": {}
    },
    "gitnexus": {
      "command": "gitnexus",
      "args": ["mcp"]
    }
  }
}
```

Restart Cursor or save the file. Verify in **Settings → MCP**.

## Claude Code example (`~/.claude/settings.json`)

Merge into existing JSON (do not remove hooks):

```json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp"
    },
    "gitnexus": {
      "command": "gitnexus",
      "args": ["mcp"]
    }
  }
}
```

Or use Claude CLI:

```bash
claude mcp add context7 --url https://mcp.context7.com/mcp
claude mcp add gitnexus -- gitnexus mcp
```

## Sync Cursor → Claude

1. Copy `mcpServers` block from `~/.cursor/mcp.json`.
2. Paste under `mcpServers` in `~/.claude/settings.json` (adjust `command`/`url` if Claude requires different shape).
3. Install binaries (`gitnexus`, etc.) on PATH for both tools.
4. **Do not** enable duplicate harness hooks: in Cursor, turn off **Third-party skills** if you use `.cursor/hooks.json` only (see [CURSOR.md](CURSOR.md)).

## Agent usage rules (save tokens)

- Call **context7** before pasting large API docs into chat.
- Call **gitnexus** for “where is X defined?” instead of broad `grep` + multi-file reads.
- Prefer MCP **once per question**; avoid chaining redundant doc fetches.
- Tiny lane: skip MCP unless blocked on a specific library API.

See also [TOKEN_EFFICIENCY.md](TOKEN_EFFICIENCY.md).
