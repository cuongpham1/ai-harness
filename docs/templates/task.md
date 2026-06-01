# Task: [Title]

**ID:** task-XXX
**Status:** todo
**Priority:** high | medium | low
**Lane:** tiny | normal | high-risk
**Story ID:** US-XXX (optional)
**Risk flags:** (e.g. native bridge, cross-module, breaking change)
**Created:** YYYY-MM-DD

## Product Contract

What behavior this task must make true (1-3 sentences).

## Acceptance Criteria

- [ ] AC1
- [ ] AC2
- [ ] AC3

## Scope

**Files expected to change:**
- `lib/modules/<module>/...`

**Files must NOT change:**
- (list files out of scope)

## Validation

| Layer | Expected proof |
|---|---|
| Unit | `flutter test test/...` |
| Widget | `flutter test test/.../widget_test.dart` |
| Integration | `bash scripts/run_integration_test.sh` |
| UI (mobile-mcp) | Screenshot verify on device |

## Fixer Guidance

Hints for coder agent (gotchas, patterns to follow, decisions already made).

## Notes

### Before-Work — YYYY-MM-DD
**Agent:** pm
**Plan:** ...

<!-- After-Work notes appended below by agents -->
