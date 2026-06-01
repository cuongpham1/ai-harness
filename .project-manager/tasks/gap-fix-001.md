# gap-fix-001 — Harness Gap Fixes

**Status:** done
**Agent:** coder

## Notes

### After-Work — 2026-05-29
**Agent:** coder

**Done:**
- Created `scripts/hooks/trace-logger.mjs` — SubagentStart/Stop structured JSONL tracer writing to `kg/traces/YYYY-MM-DD.jsonl`, pending map in `kg/runtime/trace-pending.json`
- Created `scripts/trace-viewer.mjs` — CLI trace reader with --tail, --date, --agent, --stats flags, ANSI color output
- Created `scripts/utils/retry.js` — CommonJS exponential backoff with jitter, `withRetry` + `withTimeout`
- Created `scripts/utils/state-recovery.js` — CommonJS crash recovery: `scanForStaleTemps`, `recoverIfCorrupt`, `reportRecovery`
- Created `scripts/hooks/content-guard.mjs` — PreToolUse ESM hook blocking private keys, AWS keys, .env/.pem writes outside test dirs; warns on generic credential patterns
- Created `benchmark/README.md` — benchmark system docs
- Created `benchmark/run.sh` — bash benchmark runner with per-task timing, pass/fail, JSONL results
- Created `benchmark/tasks/sample-01.json` — sample code-generation task
- Created `scripts/upgrade.sh` — smart upgrade script: copies new files only, merges settings.json hooks via inline Node.js, updates .gitignore
- Modified `scripts/utils/atomic-write.js` — appended `writeAtomicVersioned` (rotating .bak.N backups) and `recoverIfCorrupt`; updated `module.exports`
- Modified `.claude/settings.json` — added trace-logger hooks to SubagentStart/SubagentStop; added content-guard hooks to PreToolUse for Write and Edit matchers
- Modified `install.sh` — added upgrade mode detection with prompt, updated `copy_file`/`copy_dir` to respect `UPGRADE_MODE`, added new gitignore entries (`kg/traces/`, `benchmark/results/`), added `kg/traces/` runtime dir creation, added copy calls for benchmark/, trace-viewer.mjs, upgrade.sh

**Files:**
- `/Users/cuongpham/Desktop/ai-harness/scripts/hooks/trace-logger.mjs` (new)
- `/Users/cuongpham/Desktop/ai-harness/scripts/trace-viewer.mjs` (new)
- `/Users/cuongpham/Desktop/ai-harness/scripts/utils/retry.js` (new)
- `/Users/cuongpham/Desktop/ai-harness/scripts/utils/state-recovery.js` (new)
- `/Users/cuongpham/Desktop/ai-harness/scripts/hooks/content-guard.mjs` (new)
- `/Users/cuongpham/Desktop/ai-harness/benchmark/README.md` (new)
- `/Users/cuongpham/Desktop/ai-harness/benchmark/run.sh` (new)
- `/Users/cuongpham/Desktop/ai-harness/benchmark/tasks/sample-01.json` (new)
- `/Users/cuongpham/Desktop/ai-harness/scripts/upgrade.sh` (new)
- `/Users/cuongpham/Desktop/ai-harness/scripts/utils/atomic-write.js` (modified)
- `/Users/cuongpham/Desktop/ai-harness/.claude/settings.json` (modified)
- `/Users/cuongpham/Desktop/ai-harness/install.sh` (modified)

**Decisions:**
- trace-logger generates agentId from `timestamp+type` on START, stores in pending map; STOP matches by agentType (first pending entry). Simple approach — works for typical single-agent-type-at-a-time usage. Multiple concurrent same-type agents would mismatch order.
- content-guard WARN uses regex match on pattern then checks surrounding text for placeholder patterns before warning. Avoids false positives on `api_key = YOUR_KEY_HERE`.
- `writeAtomicVersioned` rotates in-place using renames (no tmp for backups) — rename is atomic; the main write still uses `writeAtomic`.
- `benchmark/run.sh` uses a TODO block for the actual claude invocation since the CLI interface varies by environment.
- upgrade.sh uses inline heredoc Node.js script to merge settings.json atomically — no external deps.

**Risks:**
- trace-logger STOP match is by agentType only (no session correlation). Concurrent agents of same type may get mismatched durations. Acceptable for observability use.
- content-guard WARN patterns are heuristic — may warn on legitimate test fixtures that contain placeholder-free credential patterns. Can tune WARN_PATTERNS regex as needed.
- benchmark/run.sh requires the TODO block to be filled in before it produces meaningful pass/fail results.

### After-Work (fix round) — 2026-05-29
**Agent:** coder
**Done:** Fixed 2 BLOCKERs + 3 MAJORs + 3 MINORs
**Files:** content-guard.mjs, trace-logger.mjs, state-recovery.js, upgrade.sh
**Decisions:**
- BLOCKER 1: Added `g` flag to all WARN_PATTERNS, replaced `match`+`indexOf` with `matchAll`+`match.index` — each occurrence examined independently.
- BLOCKER 2: Changed `/\.env$/` to `/\.env(\..+)?$/` — now covers `.env.local`, `.env.production`, etc.
- MAJOR 1: Replaced read+writeAtomic in `appendJsonl` with `fs.appendFileSync` — POSIX atomic for small appends, no TOCTOU window.
- MAJOR 2: `handleStop` now collects all matches by agentType and picks the one with the highest `startTs` (newest), not first encountered.
- MAJOR 3: Removed verbatim duplicate `recoverIfCorrupt` from state-recovery.js; added it to the destructured import from `./atomic-write`. Also dropped now-unused `writeAtomic` from that import.
- MINOR 1: Added `printf '\n' >> "$GITIGNORE"` before the gitignore loop in upgrade.sh.
- MINOR 2: Changed `set -uo pipefail` to `set -euo pipefail` in upgrade.sh.
- MINOR 3: Removed dead `import { createInterface } from 'readline'` from content-guard.mjs.
**Risks:** No remaining risks from these changes. `appendFileSync` is safe for concurrent JSONL appends under POSIX. The `g` flag on WARN_PATTERNS regex makes them stateful when reused across calls — but each `checkContent` call uses `matchAll` which creates a fresh iterator, so no lastIndex contamination issue.
