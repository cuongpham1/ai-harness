# HUD Enhancements

This directory contains enhancements to the Heads-Up Display (HUD) for the Claude Tools Workspace.

## New Elements Added

### 1. Quota/Rate Limits Tracking (`quota.mjs`)

Displays information about API quota/rate limits including:
- Remaining requests/tokens
- Total limit
- Reset time information
- Status indicator (ok/limited/exceeded)

### 2. Sub-Agent Progress Tracking (`agents.mjs`)

Tracks spawned sub-agents including:
- Total spawned agents
- Currently running agents
- Completed agents
- Types of agents spawned

## State Management

The HUD state is persisted to `kg/runtime/hud-state.json` with:

```json
{
  "quota": {
    "remaining": 85,
    "limit": 100,
    "resetAt": "2026-04-14T15:30:00.000Z",
    "status": "ok"
  },
  "agents": {
    "spawned": 3,
    "running": 1,
    "completed": 2,
    "types": ["coder", "reviewer", "debugger"]
  }
}
```

## Configuration

The HUD configuration now includes:
- `quota: true` - Enable quota display
- `agents: true` - Enable agent tracking display

Colors are configurable:
- `quota` - Color for quota display
- `agents` - Color for agents display
- `running` - Color for running agents
- `completed` - Color for completed agents
- `spawned` - Color for spawned agents
- `warning` - Color for warnings
- `error` - Color for errors
- `ok` - Color for OK status

## Usage

The HUD elements will be displayed in the status line when:
1. The appropriate elements are enabled in the configuration
2. Relevant data is available in the input JSON or state

The elements integrate with the existing HUD structure and follow the same pattern as other elements.