# Task: H5 Self-Improving Harness

**ID:** h5-self-improve
**Status:** done
**Lane:** normal
**Risk:** medium
**Created:** 2026-06-01

## Goal

Implement H5 maturity level: self-improvement protocol that works without runtime logs (template repo constraint). Friction patterns → structured proposals → human-gated apply → outcome recording.

## Acceptance Criteria

- [ ] `docs/SELF_IMPROVE.md` exists with protocol, risk tiers, rollback criteria, human gate conditions
- [ ] `docs/templates/harness-proposal.md` schema: Summary, Predicted Impact, Risk, Validation Plan, Rollback, Status, Outcome
- [ ] `docs/proposals/` and `docs/proposals/archive/` directories exist (with `.gitkeep`)
- [ ] `scripts/h5-structural-audit.mjs` — analyzes hook coverage gaps, doc staleness, template completeness, agent parity; outputs structured JSON
- [ ] `scripts/propose-change.mjs` — reads backlog friction + structural audit output → writes draft proposal file to `docs/proposals/`
- [ ] `scripts/hooks/h5-propose.mjs` — Stop hook, calls propose-change.mjs when friction backlog rows increase
- [ ] `scripts/apply-proposal.sh` — validates status=approved, applies changes, records outcome; blocks high-risk without `--approve-risk=high`
- [ ] `scripts/verify-h5.sh` — checks all 6 H5 criteria, exits 0 on pass
- [ ] `docs/HARNESS_MATURITY.md` H5 status updated to "Achieved"
- [ ] `docs/HARNESS_COMPONENTS.md` coverage summary updated
- [ ] Hook `h5-propose.mjs` wired in `.claude/settings.json` Stop hooks

## Context

- Template repo — no runtime logs from real projects
- Structural audit replaces runtime traces as data source
- Existing: `scripts/check-agent-parity.mjs`, `scripts/friction-by-component.mjs`, `harness-cli query backlog/friction`, `benchmark/compare.mjs`
- High-risk changes = AGENTS.md structure, ARCHITECTURE.md direction, TEST_MATRIX.md validation requirements, hook execution order
- Skip Rust CLI `import-friction` — out of scope

## Files to create/modify

New: `docs/SELF_IMPROVE.md`, `docs/templates/harness-proposal.md`, `docs/proposals/.gitkeep`, `docs/proposals/archive/.gitkeep`, `scripts/h5-structural-audit.mjs`, `scripts/propose-change.mjs`, `scripts/hooks/h5-propose.mjs`, `scripts/apply-proposal.sh`, `scripts/verify-h5.sh`

Modify: `docs/HARNESS_MATURITY.md`, `docs/HARNESS_COMPONENTS.md`, `.claude/settings.json`

## Notes

### After-Work — 2026-06-01
**Agent:** coder
**Outcome:** completed
**Done:** Implemented H5 self-improvement loop — structural audit, proposal generation, human-gated apply, Stop hook, verify script, protocol doc, and updated maturity/component docs. verify-h5.sh passes 6/6.
**Files changed:** docs/SELF_IMPROVE.md, docs/templates/harness-proposal.md, docs/proposals/.gitkeep, docs/proposals/archive/.gitkeep, scripts/h5-structural-audit.mjs, scripts/propose-change.mjs, scripts/hooks/h5-propose.mjs, scripts/apply-proposal.sh, scripts/verify-h5.sh, docs/HARNESS_MATURITY.md, docs/HARNESS_COMPONENTS.md, .claude/settings.json
**Errors:** none
**Friction:** none
**Decisions:** HARNESS_COMPONENTS.md row 11 (Intervention recording) updated from Partial to Covered because the H5 proposal lifecycle (draft→approved→applied→outcome) constitutes structured intervention recording. Coverage summary updated to 11/11.
**Risks/Blockers:** none

### After-Work — 2026-06-01 (fix pass)
**Agent:** coder
**Outcome:** completed
**Done:** Applied all BLOCKER/MAJOR/MINOR code review fixes: Python injection via heredoc+sys.argv, arg-parse rewrite to while loop, PROP_ID format validation, spawnSync .error check in h5-propose.mjs, execFileSync replaced with spawnSync in propose-change.mjs, JSON.parse in loadFrictionData confirmed already wrapped.
**Files changed:** scripts/apply-proposal.sh, scripts/hooks/h5-propose.mjs, scripts/propose-change.mjs
**Errors:** none
**Friction:** none
**Decisions:** Kept try/catch removed from audit spawnSync block per spec (replaced with .error check). loadFrictionData JSON.parse was already in try/catch — no change needed there.
**Risks/Blockers:** none
