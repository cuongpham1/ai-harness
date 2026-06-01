# Feature Intake

Every implementation prompt passes this gate **before** code changes. The human does not need to pick the lane; the agent classifies and states it in the task file.

## Flow

```text
User prompt
  → Classify input type
  → Restate as .project-manager task
  → Risk checklist (this project)
  → Lane: tiny | normal | high-risk
  → Link TEST_MATRIX proof expectations
```

## Input types

| Type | Use when | Artifact |
|------|----------|----------|
| Change request | Bug fix or small behavior change | Update existing `task-*.md` or new task |
| New feature | New screen, flow, or module slice | New task + scope files |
| Maintenance | Refactor, deps, l10n, test infra | Task or direct patch if tiny |
| Harness improvement | Agents, docs, ai_test, hooks | `docs/*`, `.claude/*`, `scripts/ai_test/*` |
| Native contract | Host bridge envelope or channel | Task + `README_INTEGRATION.md` + decision record |

## Lanes

### Tiny

Docs-only, copy, typos, single-widget style, comment cleanup.

**Requirements:** Patch directly; `flutter analyze` if Dart touched; no full pipeline unless user asks.

### Normal

Story-sized Flutter work: one module feature, BLoC + page, tests, route.

**Requirements:**

- Task file with AC from [templates/task.md](templates/task.md)
- Scope files listed
- Unit and/or widget tests for new logic
- Integration test if user-visible flow changed (see TEST_MATRIX)
- Full pipeline: coder → spec-reviewer → reviewer → tester

### High-risk

Security, money movement, native bridge, auth tokens, cross-variant behavior, or weak test coverage on touched code.

**Requirements:**

- Everything in **normal**, plus:
- Human confirmation before merge if contract or auth changes
- Decision note in `.project-manager/decisions.md` or `docs/decisions/ADR-*.md`
- Integration test and/or AI UAT row in TEST_MATRIX must pass or waiver documented
- Never call `MethodChannel` outside `ModuleBusChannelDataSource`

## Risk checklist (flutter_module_bus)

Mark each flag that applies:

| Flag | Applies when |
|------|----------------|
| **Native bridge** | `MethodChannel`, `bus.command`, `host.getInitialConfig`, host callbacks |
| **Auth / secrets** | `standalone_secrets.dart`, JWT, env, token refresh |
| **Public contract** | `README_INTEGRATION.md`, envelope shape, route names host depends on |
| **Cross-variant** | `APP_VARIANT` dgo vs dstock, fonts, bundle IDs |
| **Financial / IPO** | Registration, payment, order submit, custody accounts |
| **Data model** | Entity/repository schema consumed by multiple features |
| **Weak proof** | No unit test and no integration row for changed behavior |
| **Multi-module** | DI, router, and more than one `lib/modules/*` touched |

## Classification

```text
0–1 flags     → tiny or normal (by code impact)
2–3 flags     → normal with stronger validation (integration + analyze)
4+ flags      → high-risk
Any hard gate → high-risk
```

**Hard gates (always high-risk):**

- Native bridge contract changes
- Auth / JWT / secrets handling
- IPO registration submit or payment
- Removing or weakening tests listed in TEST_MATRIX

## Intake output template

End intake with this block (copy into task file):

```text
Lane: normal
Reason: IPO registration form validation; touches financial flow, weak prior UAT on form fields.
Task: .project-manager/tasks/task-00X.md
Docs: CLAUDE.md, docs/TEST_MATRIX.md (IPO Registration Form rows)
Validation: flutter test integration_test/... ; optional bash scripts/ai_test/run_uat_ios.sh
```

## IPO-specific notes

- Standalone dev uses `STANDALONE_ENV=uat` and `lib/config/standalone_secrets.dart` — token expiry causes flaky catalog/API tests, not always app bugs.
- `MissingPluginException` in debug overlay when standalone — **not a bug** (documented in `scripts/ai_test/explore_prompt.md`).
- Back button on root catalog in standalone — **expected** no-op.
