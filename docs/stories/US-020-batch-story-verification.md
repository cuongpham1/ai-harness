# US-020 Batch Story Verification

## Status

implemented

## Lane

normal

## Product Contract

Harness can verify every story with a configured `verify_command` in one
command and report passed, failed, and skipped stories.

## Relevant Product Docs

- `docs/HARNESS.md`
- `docs/HARNESS_MATURITY.md`

## Acceptance Criteria

- `story verify-all` runs every non-empty story verification command.
- Stories without `verify_command` are skipped.
- Per-story results print before the summary.
- Exit code is 1 when any story fails.

## Design Notes

- Commands: `story verify-all`.
- Tables: existing `story.verify_command`, `last_verified_at`,
  `last_verified_result`.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Rust test covers pass, fail, and skipped stories. |
| Integration | CLI smoke with mixed story commands. |
| E2E | Not applicable. |
| Platform | `scripts/bin/harness-cli story verify-all` final smoke. |
| Release | Final workspace fmt/test/clippy. |

## Harness Delta

H4 status can be claimed achieved once batch verification is documented and
final proof passes.

## Evidence

- `cargo test --workspace` passed with `story_verify_all_reports_pass_fail_and_skipped`.
- Final proof: `scripts/bin/harness-cli story verify-all` passed with 21
  stories checked, 11 passed, 0 failed, and 10 skipped without
  `verify_command`.
