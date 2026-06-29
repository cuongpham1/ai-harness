# harness-upgrade-ziwei-001: Upgrade + fix harness gitignore in ziwei-doushu

**Status:** done
**Lane:** normal
**Risk:** low

## Target
`/Users/cuongpham/ziwei-doushu`

## Current state
- harness-cli: v0.1.7 (needs v0.1.10)
- .harness-profile: nextjs
- schema: version 2 (needs migrations 003-005)
- CRITICAL: .gitignore ignores `.claude/`, `.cursor/`, `scripts/`, `templates/`, `AGENTS.md` — team gets nothing

## Tasks

### 1. Upgrade binary + copy new files (same as flutter upgrade)
- `scripts/bin/harness-cli` → v0.1.10
- `scripts/schema/003-005`
- `scripts/hooks/sync-harness-trace.mjs` (updated)
- New scripts: apply-proposal.sh, h5-structural-audit.mjs, install-skills.sh,
  instinct-tracker.mjs, list-profiles.mjs, profile-manifest.mjs, propose-change.mjs,
  security-shield.mjs, verify-h5.sh, sync-cursor-agents.mjs, install-cursor-layer.sh
- New docs: HARNESS_AUDIT.md, IMPROVEMENT_PROTOCOL.md, TOOL_REGISTRY.md
- Story files: US-019→027
- CLAUDE.md (root), .gitattributes

### 2. Run migrations
`scripts/bin/harness-cli migrate` in target

### 3. Fix .gitignore — CRITICAL
Remove these incorrect entries:
- `.claude/` (should be tracked — hooks + agents)
- `.cursor/` (should be tracked)
- `scripts/` (should be tracked — all harness scripts)
- `templates/` (should be tracked)
- `AGENTS.md` (MUST be tracked — Codex/Claude Code reads this)
- `.harness-profile` (should be tracked — tells team which framework)

Keep these correct entries:
- `harness.db`, `harness.db-wal`, `harness.db-shm`, `harness.db.bak`
- `kg/runtime/`, `kg/traces/`
- `benchmark/results/`
- `scripts/bin/harness-cli` (OS-specific binary)
- `.project-manager/tasks/*.md.bak`

Add if missing:
- `harness.db.bak`
- `.claude/settings.json.bak-*`
- `.claude/settings.local.json` (may contain local secrets)
- `docs/security-audit-*.md`

### 4. Stage + commit everything
After gitignore fix, git add all harness files that should be tracked.

## AC
- [x] `scripts/bin/harness-cli --version` = 0.1.10
- [x] schema version 5 after migrate
- [x] `.claude/`, `scripts/`, `templates/`, `AGENTS.md` NOT in .gitignore
- [x] `.harness-profile` NOT in .gitignore
- [x] `harness.db` still in .gitignore
- [x] `scripts/bin/harness-cli` still in .gitignore
- [x] All harness files committed to git
- [x] No Next.js source files (app/, components/, lib/, types/) touched

## Notes

### After-Work — 2026-06-29
**Agent:** pm
**Outcome:** partial
**Done:** coder agent dispatched to upgrade harness in ziwei-doushu from v0.1.7 to v0.1.10, fix critical gitignore (remove .claude/ .cursor/ scripts/ templates/ AGENTS.md .harness-profile), commit all harness infrastructure; still running in background
**Actions:** created task file, analyzed gitignore issues, delegated to coder
**Files read:** /Users/cuongpham/ziwei-doushu/.gitignore, ziwei scripts/ structure
**Files changed:** .project-manager/tasks/harness-upgrade-ziwei-001.md
**Errors:** none
**Friction:** none
**Decisions:** fix gitignore before commit — 6 incorrect entries blocking team sync
**Risks/Blockers:** agent completing async — verify on next session with `grep "^scripts/" /Users/cuongpham/ziwei-doushu/.gitignore` (should return nothing)

### After-Work — 2026-06-29
**Agent:** coder
**Outcome:** completed
**Done:** Upgraded ziwei-doushu harness to v0.1.10, applied schema migrations 003-005 (v2->v5), fixed .gitignore to stop ignoring harness infra, and committed 148 harness files (commit f0e8350).
**Actions:** read task spec, read target .gitignore, copied harness-cli binary + schema 003-005 + sync-harness-trace.mjs, ran harness-cli migrate, copied 12 H5/profile scripts + utils/, copied HARNESS docs + US-019..027 stories + CLAUDE/PHASE5/CHANGELOG/.gitattributes, surgically edited .gitignore, verified with git check-ignore, staged + committed
**Files read:** /Users/cuongpham/Desktop/ai-harness/.project-manager/tasks/harness-upgrade-ziwei-001.md, /Users/cuongpham/ziwei-doushu/.gitignore
**Files changed:** /Users/cuongpham/ziwei-doushu/.gitignore, scripts/bin/harness-cli, scripts/schema/003-005, scripts/hooks/sync-harness-trace.mjs, +143 new harness files (commit f0e8350)
**Errors:** none (grep "^\.claude" false-positive matched new settings-backup entries; git check-ignore confirmed .claude/ dir trackable, binary+db+settings.local still ignored)
**Friction:** none
**Decisions:** committed directly to main in target per explicit task spec (target is a separate repo); added ADMIN_GUIDE.md explicitly (git add -u missed untracked); source harness-cli-release-tag identical (both v0.1.7) so left as-is; kept existing .project-manager/tasks/ ignore line (not in removal list)
**Risks/Blockers:** SOURCE scripts/harness-cli-release-tag still reads v0.1.7 despite binary being 0.1.10 — stale tag in source repo, out of scope. Team must download OS-specific binary before `migrate` (binary intentionally gitignored).
