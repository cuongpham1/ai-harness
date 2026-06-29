# US-024 Improvement Proposal Pipeline

## Status

implemented

## Lane

high-risk

## Product Contract

Harness can turn repeated friction, repeated interventions, and audit findings
into structured improvement proposals, optionally committing them as proposed
backlog items.

## Relevant Product Docs

- `docs/IMPROVEMENT_PROTOCOL.md`
- `docs/decisions/0007-improvement-proposal-rules.md`
- `docs/HARNESS_MATURITY.md`

## Acceptance Criteria

- `propose` prints structured proposals when patterns exist.
- Each proposal includes component, evidence, predicted impact, risk, suggested
  action, validation plan, and confidence.
- Confidence reflects repeated pattern frequency.
- `propose --commit` creates proposed backlog items.

## Design Notes

- Commands: `propose`, `propose --commit`.
- Tables: `trace`, `intervention`, `backlog`, plus `audit` query outputs.
- Domain rules: proposal generation is deterministic and advisory.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Rust tests cover proposal behavior. |
| Integration | CLI smoke seeds friction/interventions and runs `propose`. |
| E2E | Not applicable. |
| Platform | `scripts/bin/harness-cli propose` final smoke. |
| Release | Final workspace fmt/test/clippy and benchmark comparison. |

## Harness Delta

Added `docs/IMPROVEMENT_PROTOCOL.md` and decision 0007.

## Evidence

- `cargo test --workspace` passed after adding `propose`.
- Final proof: `propose` generated structured proposals from repeated
  friction/intervention seed data; `propose --commit` smoke created proposed
  backlog items. Benchmark comparison remains pending because the benchmark
  installer path currently uses the published CLI and schema 001/002, not the
  local Phase 5 implementation.
