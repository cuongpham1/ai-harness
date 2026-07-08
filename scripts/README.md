# Scripts

This directory contains harness automation tools.

## Harness CLI

The Rust Harness CLI is the primary interface for the durable layer. Installed
projects use the prebuilt binary at `scripts/bin/harness-cli` for normal
Harness work.

```bash
scripts/bin/harness-cli init          # Create the database
scripts/bin/harness-cli migrate       # Apply schema migrations
scripts/bin/harness-cli intake ...    # Record a feature intake classification
scripts/bin/harness-cli story add ... # Add a story (optional --verify "cmd")
scripts/bin/harness-cli story update ...  # Proof flags: --unit 1 --integration 1 (not yes/no)
scripts/bin/harness-cli story verify <id>  # Run one story verify_command
scripts/bin/harness-cli story verify-all   # Verify every story that has verify_command
scripts/bin/harness-cli decision ...  # Add a decision or run its verification
scripts/bin/harness-cli backlog ...   # Add or close a backlog item
scripts/bin/harness-cli trace ...     # Record an agent execution trace
scripts/bin/harness-cli score-trace   # Score a trace against TRACE_SPEC.md tiers
scripts/bin/harness-cli verify-chain  # Tamper-evident trace hash chain
scripts/bin/harness-cli query ...     # matrix, backlog, traces, friction, cost, stats, sql
```

**Phase 5 (spec/docs — not in current binary):** `tool`, `intervention`, `score-context`, `audit`, `propose`, `query tools`, `query interventions`. See [docs/TOOL_REGISTRY.md](../docs/TOOL_REGISTRY.md) and [PHASE5.md](../PHASE5.md).

Run `scripts/bin/harness-cli help` or `scripts/bin/harness-cli query help` for full usage.

The schema lives in `scripts/schema/` (`001-init.sql`, `002-story-verify.sql`) and is
version-controlled. The database file (`harness.db`) is `.gitignore`d.

**CLI version:** source installer pin **0.1.11** via `scripts/harness-cli-release-tag` ([repository-harness release](https://github.com/hoangnb24/repository-harness/releases/tag/harness-cli-v0.1.11)). Rebuild locally (includes `query cost`):

```bash
bash scripts/rebuild-harness-cli.sh
# or: cargo build --release -p harness-cli && cp target/release/harness-cli scripts/bin/harness-cli
```

**Solo-dev target refresh** (hooks/agents; does not change `.gitignore`):

```bash
bash scripts/sync-harness-layer.sh /path/to/target
node scripts/hooks/update-pm-readme.js --refresh-all
```

Requires: the prebuilt Rust CLI at `scripts/bin/harness-cli` (or a local build as above).

## H3 observability scripts

```bash
node scripts/friction-by-component.mjs       # group friction by harness component
node scripts/friction-by-component.mjs --json  # JSON output for benchmark
bash scripts/verify-h3.sh                      # full H3 maturity check
bash scripts/verify-story.sh                   # H4 lane-aware lint/test for active task
bash scripts/verify-h4.sh                      # H3 + agent parity + H4 dry-run
node scripts/check-agent-parity.mjs            # CI: .claude vs .cursor agent bodies
bash benchmark/run-harness.sh                  # deterministic harness benchmark
node benchmark/compare.mjs baseline.jsonl current.jsonl
```

See `docs/FRICTION_REVIEW.md` and `benchmark/PROTOCOL.md`.

## Optional Langfuse Export

Stop hook `scripts/hooks/export-langfuse-trace.mjs` can export newly synced
Harness traces to Langfuse for external production observability.

Enable with environment variables:

```bash
export HARNESS_LANGFUSE_ENABLED=1
export HARNESS_LANGFUSE_HOST="https://cloud.langfuse.com"
export HARNESS_LANGFUSE_PUBLIC_KEY="pk-lf-..."
export HARNESS_LANGFUSE_SECRET_KEY="sk-lf-..."
```

The exporter is best-effort and non-blocking. State file:
`kg/runtime/langfuse-export-state.json`.

Direct database inspection may still use SQLite tools, but normal Harness use
should go through the Rust CLI.

### Rust CLI Commands (shipped)

```bash
scripts/bin/harness-cli init
scripts/bin/harness-cli migrate
scripts/bin/harness-cli import brownfield
scripts/bin/harness-cli intake ...
scripts/bin/harness-cli story add ...
scripts/bin/harness-cli story update ...
scripts/bin/harness-cli decision add ...
scripts/bin/harness-cli decision verify ...
scripts/bin/harness-cli backlog add ...
scripts/bin/harness-cli backlog close ...
scripts/bin/harness-cli trace ...
scripts/bin/harness-cli score-trace
scripts/bin/harness-cli verify-chain
scripts/bin/harness-cli query matrix
scripts/bin/harness-cli query backlog
scripts/bin/harness-cli query decisions
scripts/bin/harness-cli query intakes
scripts/bin/harness-cli query traces
scripts/bin/harness-cli query friction
scripts/bin/harness-cli query cost
scripts/bin/harness-cli query stats
scripts/bin/harness-cli query sql ...
```

### Phase 5 (planned — documented, not in binary yet)

`score-context`, `tool register/check/remove`, `intervention add`, `audit`, `propose`, `query tools`, `query interventions`. Track in [PHASE5.md](../PHASE5.md).

`query cost` now reports token coverage by agent/lane (`with_tokens`, `missing_w_note`, `missing_wo_note`), Langfuse export coverage (`exported_lf`, `pending_export`), plus USD estimate via `HARNESS_USD_PER_MTOK`.
`query stats` includes repo-level token observability and Langfuse export coverage.

`scripts/bin/harness-cli import brownfield` seeds or refreshes the durable database
from existing Harness v0 markdown in `docs/TEST_MATRIX.md`,
`docs/decisions/`, and `docs/HARNESS_BACKLOG.md`. This keeps already-installed
Harness repos on the Rust CLI path without losing their populated operating
docs.

## Installer

The upstream installer applies the Harness v0 operating files and folder
structure to a target project directory. It defaults to the current directory,
accepts a target path, and asks interactive users whether to `1. Merge`,
`2. Override`, or `3. Stop` when the target already contains `AGENTS.md`,
`docs/`, or `scripts/`.
Non-interactive installs stop on those protected paths unless `--merge` or
`--override` is provided. Use `--merge` as the safe update path for repositories
that already have Harness: it keeps existing files in place and creates only
missing Harness files. Add `--refresh-agent-shim` when an older install has the
full generated Harness guide in `AGENTS.md` and should move to the small stable
shim. Use `--override` only when replacing the protected Harness surface is
intentional.

```bash
curl -fsSL "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.sh?$(date +%s)" | bash -s -- --yes
```

```bash
curl -fsSL "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.sh?$(date +%s)" | bash -s -- --merge --yes
```

```bash
curl -fsSL "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.sh?$(date +%s)" | bash -s -- --merge --refresh-agent-shim --yes
```

`--refresh-agent-shim` backs up `AGENTS.md` before changing it. If the existing
file is recognized as the old Harness-generated operating guide, the installer
replaces it with the current shim. Otherwise it appends or replaces only the
marked `<!-- HARNESS:BEGIN -->` block so project-specific instructions remain
in place.

The installer must stay limited to harness files. Do not use it to scaffold
application source folders, package scripts, CI, tests, platform shells, or fake
validation commands. The installer script is not part of the installed project
payload.

By default the installer also downloads the prebuilt Rust Harness CLI for the
current platform into `scripts/bin/harness-cli` and verifies its `.sha256`
checksum before making it executable. The release is pinned through
`scripts/harness-cli-release-tag` (currently `harness-cli-v0.1.11`). Set
`HARNESS_CLI_RELEASE_TAG` to override that tag, or set `HARNESS_CLI_BASE_URL` to
point at an alternate artifact directory, such as a local `file:///.../dist`
directory created by `scripts/build-harness-cli-release.sh`.

## Schema Migrations

Migration files live under `scripts/schema/` and are named `NNN-description.sql`
where `NNN` is a zero-padded version number. Run `scripts/bin/harness-cli migrate` to
apply pending migrations.

## Future Command Contract

Expected future checks:

```text
validate:quick
  format, lint, typecheck, unit tests, architecture check

test:integration
  backend contract and integration checks

test:e2e
  user-visible end-to-end flows

test:platform
  platform shell smoke checks, if the project has a native shell

test:release
  full suite, log checks, and performance smoke
```

## Release Packaging

Build the current-platform Rust CLI release artifact from the source repo:

```bash
scripts/build-harness-cli-release.sh
```

The script writes `dist/harness-cli-<platform>` and
`dist/harness-cli-<platform>.sha256`. Supported labels are:

- `macos-arm64`
- `macos-x64`
- `linux-x64`
- `linux-arm64`

For cross-compilation, pass a Cargo target triple:

```bash
scripts/build-harness-cli-release.sh --target x86_64-unknown-linux-gnu
```

GitHub releases are produced by
`.github/workflows/harness-cli-release.yml`. Push a tag matching `v*` or
`harness-cli-v*` to run the verification job, build all supported targets on
native hosted runners, and upload these release assets:

- `harness-cli-macos-arm64`
- `harness-cli-macos-arm64.sha256`
- `harness-cli-macos-x64`
- `harness-cli-macos-x64.sha256`
- `harness-cli-linux-x64`
- `harness-cli-linux-x64.sha256`
- `harness-cli-linux-arm64`
- `harness-cli-linux-arm64.sha256`
