# US-022 Context Rule Measurement

## Status

implemented

## Lane

normal

## Product Contract

Harness can score a trace's `files_read` against compiled context rules and
retrieval triggers so agents can see missing must-read or should-read context.

## Relevant Product Docs

- `docs/CONTEXT_RULES.md`
- `docs/TRACE_SPEC.md`

## Acceptance Criteria

- `score-context <trace-id>` prints required versus actual context.
- Lane comes from the linked intake.
- Missing Must and Should reads are distinguished.
- Over-reading is advisory.
- Schema and CLI-code changes trigger decision 0004 and 0005 checks.

## Design Notes

- Commands: `score-context`.
- Domain rules: context phase is inferred from trace outcome, story link, and
  changed files.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Rust tests cover context scoring rules and retrieval triggers. |
| Integration | CLI smoke records a trace and scores it. |
| E2E | Not applicable. |
| Platform | `scripts/bin/harness-cli score-context` final smoke. |
| Release | Final workspace fmt/test/clippy. |

## Harness Delta

Context selection becomes measurable before future enforcement work.

## Evidence

- `cargo test --workspace` passed after adding `score-context`.
- Final proof: `score-context` smoke showed lane/phase output, missing Must
  reads, and the CLI-code decision 0005 retrieval trigger.
