# task-manifest-004: Profile Manifest State Tracking

**Status:** done
**Lane:** normal
**Priority:** low
**Created:** 2026-06-04

## Goal
Track which framework profiles are installed to prevent duplicate installs (ECC selective install with manifest-driven profiles).

## Acceptance Criteria
- [ ] New file `kg/runtime/installed-profiles.json` tracks: profile_id, installed_at, version, target_dir, checksum
- [ ] `install.sh` checks manifest before installing a profile; warns + skips if already installed (unless `--force` flag)
- [ ] `link-install.sh` also checks and updates manifest on symlink install
- [ ] New command `harness-cli query profiles` (or script `scripts/list-profiles.mjs`) shows installed profiles with status
- [ ] Uninstall updates manifest: removes entry or marks status=removed
- [ ] Documented in docs/INSTALL.md or README.md

## Context
ECC uses manifest-driven profiles (minimal/core/full) with state tracking to prevent duplicate installs.
Current harness: no tracking of what's been installed where. Re-running install.sh on same target = silent overwrite.

State file location: kg/runtime/installed-profiles.json (gitignored, local instance like harness.db)

## Notes

### After-Work — 2026-06-04
**Agent:** coder
**Outcome:** completed
**Done:** Implemented profile manifest state tracking — new shared utility (profile-manifest.mjs), list-profiles.mjs CLI, --force flag on install.sh and link-install.sh, manifest registration after each framework install, and README documentation.
**Files changed:** scripts/profile-manifest.mjs, scripts/list-profiles.mjs, install.sh, link-install.sh, README.md
**Errors:** none
**Friction:** Node ESM "main entry point" detection needed — resolved by comparing process.argv[1] to __filename so CLI block doesn't run when the module is imported.
**Decisions:** Stored manifest in harness repo's own kg/runtime/ (resolved from __dirname walking up); used isMain guard instead of top-level if-main pattern that ESM doesn't support natively; added kg/runtime/installed-profiles.json to gitignore additions in both installers.
**Risks/Blockers:** none — manifest is non-fatal (node not found or write failure prints warning, install continues)

## Notes

### After-Work (fix) — 2026-06-04
**Agent:** coder
**Outcome:** completed
**Done:**
- Fix 2 (BLOCKER): `profile-manifest.mjs` writeManifest now writes to `.tmp` then `renameSync` for atomic POSIX write — truncated-file-on-SIGKILL no longer possible
- Fix 6 (MAJOR): `install.sh` manifest check captures exit code explicitly; exit code 0=installed, 1=not installed, other=error with explicit warning that guard is inactive
- Fix 7 (MAJOR): `link-install.sh` manifest add is now conditional — skips add when already installed and FORCE=0 (was always calling add unconditionally after warning)
**Files changed:** scripts/profile-manifest.mjs, install.sh, link-install.sh
**Errors:** none
**Decisions:** `install.sh` check uses exit code only (profile-manifest.mjs `check` command exits 0/1 with no stdout); warning on exit code not in {0,1} covers node crash or missing file scenarios. `link-install.sh` resolves version/checksum before the check so the values are available in both the installed and not-installed branches.
