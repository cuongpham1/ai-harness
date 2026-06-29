# US-021 Intervention Recording Schema

## Status

implemented

## Lane

normal

## Product Contract

Harness stores human, reviewer, CI, and agent interventions separately from
normal traces so future improvement proposals can learn from corrections,
overrides, escalations, and approvals.

## Relevant Product Docs

- `docs/HARNESS.md`
- `docs/HARNESS_COMPONENTS.md`

## Acceptance Criteria

- Migration 004 creates the `intervention` table.
- `intervention add` records interventions.
- `query interventions` lists and filters by trace, story, and type.
- Trace recording prints a reminder to record human corrections.

## Design Notes

- Commands: `intervention add`, `query interventions`.
- Tables: `intervention`.
- Domain rules: type is `correction`, `override`, `escalation`, or `approval`;
  source is `human`, `reviewer`, `ci`, or `agent`.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Rust test covers add and filters. |
| Integration | CLI smoke adds and queries interventions. |
| E2E | Not applicable. |
| Platform | `scripts/bin/harness-cli` smoke after binary refresh. |
| Release | Final workspace fmt/test/clippy. |

## Harness Delta

Intervention recording becomes a covered Harness responsibility.

## Evidence

- `cargo test --workspace` passed with `interventions_can_be_added_and_filtered`.
- Final proof: temporary-DB smoke recorded interventions, filtered by trace and
  story/type, and confirmed trace recording prints the intervention reminder.
