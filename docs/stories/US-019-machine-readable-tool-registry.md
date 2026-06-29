# US-019 Machine-Readable Tool Registry

## Status

implemented

## Lane

normal

## Product Contract

Harness exposes a compiled and user-registered tool manifest so agents can
discover commands, arguments, responsibilities, and custom project tools.

## Relevant Product Docs

- `docs/TOOL_REGISTRY.md`
- `docs/HARNESS_COMPONENTS.md`

## Acceptance Criteria

- `query tools --json`, `--summary`, and `--responsibility` expose tool entries.
- `tool register` validates names, descriptions, responsibilities, commands,
  and argument specs.
- `tool remove` deletes registered tools.
- The tool table is installed by migration 003.

## Design Notes

- Commands: `query tools`, `tool register`, `tool remove`.
- Tables: `tool`.
- Domain rules: Runtime Substrate responsibility names are the allowed
  responsibility vocabulary.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Rust tests cover register/query/remove and compiled registry behavior. |
| Integration | CLI smoke with JSON, summary, responsibility filter, register, remove. |
| E2E | Not applicable; CLI-only Harness behavior. |
| Platform | `scripts/bin/harness-cli` smoke after binary refresh. |
| Release | Final workspace fmt/test/clippy. |

## Harness Delta

Added `docs/TOOL_REGISTRY.md` and migration `003-tool-registry.sql`.

## Evidence

- `cargo test --workspace` passed with `tool_registry_register_query_and_remove_work`.
- Final proof: `cargo fmt --check`, `cargo test --workspace` (25 tests),
  `cargo clippy --workspace -- -D warnings`, `query tools --json | jq`,
  responsibility filter, register/remove, and invalid registration smoke passed.
