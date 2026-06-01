# Test Matrix

Maps product behavior to required proof. Prefer `scripts/bin/harness-cli query matrix` for durable status; keep this file as human-readable reference until rows are imported.

No product-specific rows yet. Add rows when story packets are created.

## Status values

| Status | Meaning |
|--------|---------|
| planned | Accepted behavior, not implemented |
| in_progress | Actively being built |
| implemented | Proof exists |
| changed | Contract changed after implementation |
| retired | No longer in product contract |

## Quick validation ladder

Read stack commands from `docs/*_STACK.md` (installed per framework) or `.harness-profile`.

| Level | When |
|-------|------|
| Quick | Lint/typecheck on every code change |
| Unit | Domain logic, pure functions, components |
| Integration | API, DB, service contracts |
| E2E | User-visible flows |
| Platform | Deploy, native shell, mobile device (if applicable) |

## Matrix

| Story | Behavior | Unit | Integration | E2E | Platform | Status | Evidence |
|-------|----------|------|-------------|-----|----------|--------|----------|
| TBD | Add when stories are created | — | — | — | — | planned | none |

## Adding a row

1. Add row with behavior + proof level.
2. Add or extend automated tests before marking done.
3. Update proof via `scripts/bin/harness-cli story update` when using durable stories.
