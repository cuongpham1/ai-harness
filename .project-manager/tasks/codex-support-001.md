# codex-support-001: Add Codex compatibility layer to harness

**Status:** done
**Lane:** normal
**Risk:** low

## Goal
Codex (OpenAI) reads AGENTS.md natively but has no hook system. Add explicit Codex instructions so it can use harness manually without hooks.

## Changes needed

### 1. `templates/AGENTS.starter.md`
Add a `## If you are Codex (or hook-less agent)` section inside `<!-- HARNESS:BEGIN -->` block.
Must cover:
- Before work: `harness-cli query matrix`
- After work: append After-Work note with Actions + Files read fields
- After work: manually call `harness-cli trace` (since no Stop hook)
- Exact CLI command with all flags

### 2. `AGENTS.md` (installer repo root)
Same section added to the `<!-- HARNESS:BEGIN -->` block there.

### 3. `docs/CODEX.md` (new file)
Full guide: what works, what doesn't, manual trace workflow, After-Work format for Codex.

## AC
- [x] `templates/AGENTS.starter.md` has Codex section with harness-cli trace command
- [x] `AGENTS.md` has same Codex section
- [x] `docs/CODEX.md` exists with complete guide
- [x] Codex section specifies `--agent codex` flag
- [x] Codex section covers Actions + Files read fields (needed for standard tier)
- [x] No existing sections removed or broken

## Notes

### After-Work — 2026-06-29
**Agent:** pm
**Outcome:** partial
**Done:** coder agent dispatched to add Codex section to AGENTS.md, templates/AGENTS.starter.md, and create docs/CODEX.md; still running in background
**Actions:** created task file, delegated to coder
**Files read:** AGENTS.md, templates/AGENTS.starter.md, .cursor/hooks.json, .cursor/rules/harness-core.mdc
**Files changed:** .project-manager/tasks/codex-support-001.md
**Errors:** none
**Friction:** none
**Decisions:** add Codex section inside HARNESS:BEGIN/END markers, create separate docs/CODEX.md guide
**Risks/Blockers:** agent completing async — verify on next session with `grep Codex templates/AGENTS.starter.md`

### After-Work — 2026-06-29
**Agent:** coder
**Outcome:** completed
**Done:** Added Codex/hook-less agent instructions to both AGENTS files and authored docs/CODEX.md guide.
**Actions:** read task spec, read AGENTS.starter.md and AGENTS.md, inspected harness-cli trace --help for flag accuracy, edited templates/AGENTS.starter.md, edited AGENTS.md, created docs/CODEX.md, ran grep/ls verification
**Files read:** .project-manager/tasks/codex-support-001.md, templates/AGENTS.starter.md, AGENTS.md, docs/HARNESS.md
**Files changed:** templates/AGENTS.starter.md, AGENTS.md, docs/CODEX.md
**Errors:** none
**Friction:** none
**Decisions:** Sourced the trace flag reference from `harness-cli trace --help` so the CODEX.md table matches the real CLI (adds intake/story/tokens/notes beyond the spec sample). Placed Codex sections inside HARNESS:BEGIN/END blocks after existing content as specified.
**Risks/Blockers:** none
