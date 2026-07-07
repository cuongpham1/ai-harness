# task-compact-fix — Fix suggest-compact false-block on large context models

**Status:** done
**Lane:** tiny
**Risk flags:** none
**Date:** 2026-06-30

## Problem
`suggest-compact.js` PreToolUse hook (no matcher = all tools) counts cumulative
tool calls and hard-blocks at TIER3=80. Ignores actual context %. On Opus 1M,
80 tool calls ≈ 7% context → false block.

## Root cause
Hook never reads stdin. Claude Code PreToolUse hook input JSON includes
`context_window: { current_tokens, max_tokens, percent_used }`. Hook ignores it.

## Fix
1. Read stdin (async with 200ms timeout)
2. Parse hook input JSON  
3. If `context_window.percent_used` present → use % thresholds (T1=60%, T2=80%, T3=92%)
4. Fall back to tool-call count if field absent
5. Increase fallback TIER3 default from 80 → 200 (better for large-ctx models)
6. Env vars: `COMPACT_PCT_TIER1/2/3` for % thresholds; existing `COMPACT_TIER1/2/3` for count fallback

## Files
- `scripts/hooks/suggest-compact.js` — rewrite to async, add stdin read

## Notes

### After-Work — 2026-06-30
**Agent:** pm
**Outcome:** partial
**Done:** Delegated suggest-compact.js fix to @coder — rewrite to use context_window.percent_used from stdin; @coder still running
**Actions:** created task file, analyzed root cause, spawned @coder
**Files read:** scripts/hooks/suggest-compact.js, .claude/settings.json
**Files changed:** .project-manager/tasks/task-compact-fix.md
**Errors:** none
**Friction:** none
**Decisions:** % thresholds 60/80/92; count fallback TIER3 raised 80→200
**Risks/Blockers:** @coder in background — full pipeline (spec-reviewer → reviewer → tester) pending completion

### After-Work — 2026-06-30
**Agent:** coder
**Outcome:** completed
**Done:** Rewrote suggest-compact.js to read context_window.percent_used from stdin; falls back to tool-call count; raised TIER3 default to 200
**Actions:** read suggest-compact.js, read trace-logger.mjs for async pattern, rewrote suggest-compact.js
**Files read:** scripts/hooks/suggest-compact.js, scripts/hooks/trace-logger.mjs
**Files changed:** scripts/hooks/suggest-compact.js
**Errors:** none
**Friction:** none
**Decisions:** % thresholds 60/80/92; count fallback TIER3 raised 80→200
**Risks/Blockers:** none
