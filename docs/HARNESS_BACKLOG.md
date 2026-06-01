# Harness Backlog

Accumulated friction, missing docs, and process gaps found during agent work. Each item is a signal to improve the harness — not the app.

## How to add

When agent work hits friction, append a row:
```
scripts/harness backlog add "description of friction"
```
Or manually append to the table below.

## Open Items

| ID | Found | Friction | Proposed Fix | Status |
|---|---|---|---|---|
| HB-001 | 2026-05-29 | IPO registration form fields/buttons may not respond to mobile-mcp taps — semantics labels missing or incorrect | Add semantics labels to all interactive widgets in registration form | open |
| HB-002 | 2026-05-29 | `subagent-log.js` and `post-tool-task-tracker.js` were wired but `kg-paths.js` was missing — silent failure | Added `kg-paths.js`; installer should verify utils before wiring hooks | open |
| HB-003 | 2026-05-29 | `rtk discover` showed 0.1% RTK hook coverage — misleading metric (hook rewrites transparently) | Document that hook rewrites don't show as "rtk" prefix in transcripts | open |

## Closed Items

| ID | Closed | Resolution |
|---|---|---|

## Friction Tags

Use these tags in the Friction column for easy filtering:
- `docs-stale` — doc was wrong or missing
- `hook-gap` — automation hook missing or broken
- `agent-confusion` — agent made wrong decision due to missing context
- `test-gap` — behavior not covered by any test
- `tooling` — CLI or script gap
