# US-027 Inbound Tool Registry

## Status

implemented

## Lane

normal

## Product Contract

The harness must have a single place where external tools register themselves as
named providers of a capability, where presence is *scanned* rather than trusted,
and where an absent tool is a clean skip that never affects the main process.
This is the base mechanism future extensions plug into; impact-analysis is one
consumer, not a dependency.

## Relevant Product Docs

- `docs/TOOL_REGISTRY.md`

## Acceptance Criteria

- A tool registers with a `kind` (cli/binary/mcp/skill/http) and an optional
  `capability` and `scan_target`; mcp/skill/http register without `--force`.
- `tool check` scans each tool with a kind-appropriate probe, persists
  `status` + `checked_at`, and always exits 0.
- `query tools --capability X [--status present]` returns the provider set a
  workflow step uses to choose Full / Degraded / Inactive posture.
- A missing or unregistered tool never changes core harness behavior.

## Design Notes

- Commands: `tool register --kind --capability --scan`, `tool check`
- Queries: `query tools --capability --status`
- API: CLI gains `tool check`; `query tools` gains capability/status filters
- Tables: `tool` gains `kind`, `capability`, `scan_target`, `status`,
  `checked_at` (schema migration 005, additive ALTER TABLE)
- Domain rules: capability is open kebab-case; status is scanned not asserted;
  the core consults capabilities, never tools

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-027 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | `cargo test` — kind validation, capability normalization, scan-per-kind, persistence (26 pass) |
| Integration | migration v1→5 applies cleanly; register/check/query round-trip |
| E2E | registry-driven step picks correct posture and executes a discovered tool (manual demo) |
| Platform | n/a (single CLI binary) |
| Release | `cargo build`, `cargo clippy` clean, `cargo fmt --check` clean |

## Harness Delta

Generalizes the embryonic `tool register` into the harness's extension base.
The activation/degrade ladder that previously lived only in prose is now backed
by scanned `status` data the CLI reports and the agent acts on.

## Evidence

- `cargo test`: 26 passed.
- Registry-driven step demo: Inactive/Degraded/Full postures scored 3/3; a
  cli-kind tool was executed from the registry and its output consumed.
- Core isolation: identical core flow fingerprint with zero tools vs. a
  registry full of missing tools; `audit` exits 0.
- Scale: 60 tools scanned in ~20 ms (0.33 ms/tool).
