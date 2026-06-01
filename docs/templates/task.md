# Task: [Title]

**ID:** task-XXX
**Status:** todo
**Priority:** high | medium | low
**Lane:** tiny | normal | high-risk *(required for normal/high-risk)*

For **normal** and **high-risk** lanes, `**Friction:**` must use a tag from [FRICTION_REVIEW.md](../FRICTION_REVIEW.md), e.g. `hook-gap: description` or `none`.
**Story ID:** US-XXX (optional)
**Risk flags:** (e.g. auth, data_model, public_contract)
**Created:** YYYY-MM-DD

## Product Contract

What behavior this task must make true (1-3 sentences).

## Acceptance Criteria

- [ ] AC1
- [ ] AC2
- [ ] AC3

## Scope

**Files expected to change:**
- (list paths)

**Files must NOT change:**
- (list out-of-scope paths)

## Validation

| Layer | Expected proof |
|-------|----------------|
| Quick | Stack lint/typecheck (see `docs/*_STACK.md`) |
| Unit | Stack unit test command |
| Integration | API/DB/service tests if applicable |
| E2E | User-visible flow tests if applicable |

## Fixer Guidance

Hints for @coder (patterns, constraints, prior decisions).

## Notes

### Before-Work — YYYY-MM-DD
**Agent:** pm
**Plan:** ...

<!-- After-Work sections appended below. Stop hook syncs to harness-cli trace. -->

### After-Work — YYYY-MM-DD
**Agent:** coder
**Outcome:** completed | partial | blocked | failed
**Done:** One sentence summary (≥10 chars)
**Files changed:** path/a, path/b
**Decisions:** (optional)
**Errors:** none
**Friction:** none *(use tag from docs/FRICTION_REVIEW.md for normal/high-risk, e.g. hook-gap: ...)*
**Story ID:** US-XXX (optional)
