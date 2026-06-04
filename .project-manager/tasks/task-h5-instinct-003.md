# task-h5-instinct-003: H5 Instinct Confidence Threshold

**Status:** done
**Lane:** normal
**Priority:** medium
**Created:** 2026-06-04

## Goal
Improve H5 proposal loop by adding confidence scoring — decouple pattern extraction from skill generation (ECC instinct-based learning v2).

## Acceptance Criteria
- [ ] New file `kg/runtime/instincts.json` tracks friction patterns with: id, description, component, seen_count, first_seen, last_seen, confidence_score, status (emerging|stable|promoted)
- [ ] `scripts/propose-change.mjs` updated: new findings go to instincts.json first (status=emerging), only promote to proposal when confidence >= 0.75 AND seen_count >= 3
- [ ] Confidence formula: `min(1.0, (seen_count/3) * severity_weight * recency_weight)` where severity_weight: high=1.0, medium=0.7; recency_weight decays 0.1/week
- [ ] New script `scripts/instinct-tracker.mjs` upserts patterns from audit findings into instincts.json
- [ ] `scripts/h5-propose.mjs` hook calls instinct-tracker first, then propose-change with filtered list
- [ ] `harness-cli query instincts` command shows emerging patterns (or fallback: read instincts.json directly)
- [ ] Documented in docs/SELF_IMPROVE.md (new section: Instinct Confidence)

## Context
ECC v2 insight: premature codification = skill generated from single observation. Results in noise proposals.
Pattern extraction (identify friction) must be decoupled from skill generation (write proposal).
Emerging patterns tracked in kg/runtime/, only promoted when seen_count threshold met.

## Notes

### After-Work — 2026-06-04
**Agent:** coder
**Outcome:** completed
**Done:** Implemented instinct confidence threshold system — new instinct-tracker.mjs script, updated propose-change.mjs with shouldPropose() filtering, updated h5-propose.mjs hook to call instinct-tracker first, and added "Instinct Confidence Threshold" section to docs/SELF_IMPROVE.md.
**Files changed:** scripts/instinct-tracker.mjs (new), scripts/propose-change.mjs, scripts/hooks/h5-propose.mjs, docs/SELF_IMPROVE.md, kg/runtime/instincts.json (generated at runtime)
**Errors:** none
**Friction:** The AC item "harness-cli query instincts" was not implemented as it requires modifying the CLI binary (harness-cli is a compiled binary at scripts/bin/harness-cli). The task spec provided a fallback of reading instincts.json directly, which is documented in SELF_IMPROVE.md. All other ACs are satisfied.
**Decisions:** Used djb2 hash (same implementation in both tracker and propose-change) to generate stable instinct IDs from finding descriptions. Instinct filtering in propose-change.mjs applies only to audit findings that pass the existing high/medium severity filter — low-severity findings continue to be excluded upstream.
**Risks/Blockers:** harness-cli query instincts not wired (binary would need recompile); fallback (cat kg/runtime/instincts.json) documented and functional.

## Notes

### After-Work (fix) — 2026-06-04
**Agent:** coder
**Outcome:** completed
**Done:**
- Fix 1 (BLOCKER): `propose-change.mjs` shouldPropose now returns `{ propose: false }` for untracked low-severity findings instead of failing open
- Fix 3 (MAJOR): `instinct-tracker.mjs` upsertInstinct uses `finding.id` as primary stable key (falls back to djb2 hash when no id); source_ids dedup check prevents double-counting same audit run
- Fix 4 (MAJOR): `instinct-tracker.mjs` main() reads audit file mtime and skips re-count when audit unchanged (`last_audit_mtime` stored in instincts.json)
- Fix 5 (MAJOR): `instinct-tracker.mjs` saves `prevLastSeen` before mutating `last_seen`, passes old date to `calcConfidence` so recency weight isn't always 1.0
- Aligned `propose-change.mjs` lookup key to use `finding.id` first (matching new tracker ID scheme)
**Files changed:** scripts/propose-change.mjs, scripts/instinct-tracker.mjs
**Errors:** none
**Decisions:** When `finding.id` is absent in the tracker (backlog items using non-stable IDs), falls back to djb2 hash — preserves existing behaviour for backlog items while fixing audit findings.
