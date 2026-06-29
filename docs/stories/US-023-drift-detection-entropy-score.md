# US-023 Drift Detection Entropy Score

## Status

implemented

## Lane

normal

## Product Contract

Harness can audit durable records for drift and compute an entropy score with
specific findings for stories, decisions, backlog outcomes, stale work, and
registered tools.

## Relevant Product Docs

- `docs/HARNESS_AUDIT.md`
- `docs/HARNESS_COMPONENTS.md`

## Acceptance Criteria

- `audit` prints counts and record IDs for every drift category.
- Entropy score is 0 for clean records and increases with drift.
- Broken registered tools are reported.

## Design Notes

- Commands: `audit`.
- Tables: `story`, `decision`, `backlog`, `trace`, `tool`.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Rust tests cover audit behavior. |
| Integration | CLI smoke runs `audit` on seeded data. |
| E2E | Not applicable. |
| Platform | `scripts/bin/harness-cli audit` final smoke. |
| Release | Final workspace fmt/test/clippy. |

## Harness Delta

Added `docs/HARNESS_AUDIT.md`; entropy auditing can feed proposals.

## Evidence

- `cargo test --workspace` passed after adding `audit`.
- Final proof: `scripts/bin/harness-cli audit` passed on the repo database with
  entropy score 0/100 after decision verification.
