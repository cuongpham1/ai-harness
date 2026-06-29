# pull-upstream-001: Pull missing files from hoangnb24/repository-harness

**Status:** done
**Lane:** tiny
**Risk:** low

## Goal
Pull specific missing files from https://github.com/hoangnb24/repository-harness into local repo.

## Files to pull (via raw.githubusercontent.com/hoangnb24/repository-harness/main/...)

### Must pull — functional
- `scripts/schema/003-tool-registry.sql`
- `scripts/schema/004-intervention.sql`
- `scripts/schema/005-tool-extensions.sql`
- `scripts/bin/harness-cli` → OVERWRITE local binary with v0.1.10
- `docs/TOOL_REGISTRY.md`
- `docs/HARNESS_AUDIT.md`
- `docs/IMPROVEMENT_PROTOCOL.md`

### Should pull — docs/planning
- `PHASE5.md`
- `CHANGELOG.md`
- `.gitattributes`
- `docs/stories/US-019-machine-readable-tool-registry.md`
- `docs/stories/US-020-batch-story-verification.md`
- `docs/stories/US-021-intervention-recording-schema.md`
- `docs/stories/US-022-context-rule-measurement.md`
- `docs/stories/US-023-drift-detection-entropy-score.md`
- `docs/stories/US-024-improvement-proposal-pipeline.md`
- `docs/stories/US-025-post-merge-cli-release-and-changelog.md`
- `docs/stories/US-027-inbound-tool-registry.md`

### Conditional — check before writing
- `CLAUDE.md` → remote version is simpler than local `.claude/settings.json`. Pull only if local root CLAUDE.md doesn't exist (it doesn't). Place at repo root.

## Method
Use `curl -fsSL https://raw.githubusercontent.com/hoangnb24/repository-harness/main/{path} -o {local_path}` for each file.
For binary `scripts/bin/harness-cli`: download then `chmod +x`.
For stories: create `docs/stories/` files that don't exist yet (README.md and backlog.md already exist, don't overwrite).

## AC
- [ ] 3 schema SQL files present in scripts/schema/
- [ ] harness-cli binary updated to v0.1.10 (verify: `scripts/bin/harness-cli --version`)
- [ ] 3 doc files present in docs/
- [ ] PHASE5.md present at root
- [ ] 8 story files present in docs/stories/
- [ ] CHANGELOG.md present at root
- [ ] CLAUDE.md present at root
- [ ] No existing files overwritten except harness-cli binary

## Notes

### After-Work — 2026-06-29
**Agent:** pm
**Outcome:** partial
**Done:** coder agent dispatched to pull 20+ files from hoangnb24/repository-harness; still running in background
**Files changed:** none yet — agent in progress
**Errors:** none
**Friction:** none
**Decisions:** pull schema 003-005, CLI binary v0.1.10, 3 doc specs, 8 story files, PHASE5.md, CHANGELOG.md, CLAUDE.md, .gitattributes
**Risks/Blockers:** agent completing async — verify on next session with `scripts/bin/harness-cli --version` → expect 0.1.10

### After-Work — 2026-06-29
**Agent:** coder
**Outcome:** completed
**Done:** Downloaded all 18 source-tree files via curl from upstream main; resolved the missing prebuilt binary by fetching the harness-cli-v0.1.10 macOS-arm64 release asset (the binary is not committed to the repo tree, only published as a GitHub release).
**Files changed:** scripts/schema/003-tool-registry.sql, scripts/schema/004-intervention.sql, scripts/schema/005-tool-extensions.sql, scripts/bin/harness-cli (v0.1.7 -> v0.1.10), docs/TOOL_REGISTRY.md, docs/HARNESS_AUDIT.md, docs/IMPROVEMENT_PROTOCOL.md, PHASE5.md, CHANGELOG.md, .gitattributes, docs/stories/US-019..025, docs/stories/US-027, CLAUDE.md (new, was missing at root)
**Errors:** Initial curl for scripts/bin/harness-cli returned 404 — the binary is not present in the repo tree (only crates/harness-cli source exists). Existing v0.1.7 binary was NOT clobbered because curl -f aborts before writing on 404.
**Friction:** Binary distributed only as a GitHub release asset, not committed. Fetched https://github.com/hoangnb24/repository-harness/releases/download/harness-cli-v0.1.10/harness-cli-macos-arm64 and verified SHA256 (dfdc0f7d...282) against the published .sha256 before installing.
**Decisions:** Selected macos-arm64 asset to match host (uname -m = arm64). Pulled CLAUDE.md since `ls CLAUDE.md` confirmed it was absent at root. Did not touch docs/stories/README.md or backlog.md.
**Risks/Blockers:** Installed binary is macOS-arm64-only; other-platform machines need their own release asset. The literal raw path scripts/bin/harness-cli is unobtainable upstream — satisfied via release asset instead.
