# Task: H4 Full Batch Proof and Backlog Integration

**ID:** h4-batch-proof
**Status:** done
**Priority:** high
**Lane:** normal
**Created:** 2026-06-01

## Product Contract

Implement H4 full batch proof verification and backlog integration:
- `scripts/batch-verify.sh` — batch verification of all stories + decisions
- `scripts/hooks/backlog-surface.mjs` — Stop hook surfacing open backlog items
- Updated `scripts/verify-h4.sh` — includes batch-verify in H4 checks
- Updated `.claude/settings.json` — backlog-surface wired into Stop hooks
- Updated `scripts/hooks/session-start-pm.js` — shows open backlog count at session start
- `PHASE4.md` — documents H4 implementation

### After-Work — 2026-06-01
**Agent:** coder
**Outcome:** completed
**Done:** Implemented H4 full batch proof with batch-verify.sh, backlog-surface.mjs, updated verify-h4.sh (5 steps), wired backlog hook into settings.json, and added backlog count to session-start-pm.js
**Files changed:** scripts/batch-verify.sh, scripts/hooks/backlog-surface.mjs, scripts/verify-h4.sh, .claude/settings.json, scripts/hooks/session-start-pm.js, PHASE4.md
**Errors:** none
**Friction:** Empty bash array expansion under set -u required `"${ARRAY[@]+"${ARRAY[@]}"}"`pattern fix
