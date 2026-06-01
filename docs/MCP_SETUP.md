# MCP Setup (Cursor + Claude Code)

MCP configs are **per tool**. Cursor does not share MCP with Claude Code automatically.

## Config locations

| Tool | User-level | Project-level |
|------|------------|---------------|
| **Cursor** | `~/.cursor/mcp.json` | `.cursor/mcp.json` (optional) |
| **Claude Code** | `~/.claude/settings.json` → `mcpServers` | `.claude/settings.json` → `mcpServers` |

Harness installer does **not** copy your personal MCP config. Add servers manually or via team docs.

## Recommended servers (token-efficient)

| Server | Purpose | Token impact |
|--------|---------|--------------|
| **context7** | Fetch library docs on demand | Saves vs reading full docs / long web fetch |
| **gitnexus** | Code graph / symbol navigation | Saves vs grep + read many files |
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
