# Context Engineering Rules

Context rules help agents decide what to read, when to read it, and when to stop reading. Additive to the stable `AGENTS.md` reading list.

Goal: put the right information in the model for the current task phase and risk lane — not maximize context.

## Context Phases

### Intake Phase

Read to classify request, find affected surface, choose lane.

| Document / Source | Tiny | Normal | High-Risk |
|---|---|---|---|
| `AGENTS.md` | Must | Must | Must |
| `docs/FEATURE_INTAKE.md` | Must | Must | Must |
| `.project-manager/README.md` | Must | Must | Must |
| `CLAUDE.md` | Should | Must | Must |
| `docs/HARNESS.md` | Should | Must | Must |
| `docs/TEST_MATRIX.md` | Should | Must | Must |
| `docs/ARCHITECTURE.md` (nếu tồn tại) | Skip | Should | Must |
| Relevant task files `.project-manager/tasks/` | Skip if unrelated | Must if task exists | Must |
| `docs/decisions/` | Skip | Should if architecture touched | Must |

### Planning Phase

Read to decide smallest safe approach and expected proof.

| Document / Source | Tiny | Normal | High-Risk |
|---|---|---|---|
| Files to edit | Must | Must | Must |
| `docs/templates/task.md` | Skip | Must when creating task | Should |
| `docs/TEST_MATRIX.md` | Should | Must | Must |
| `docs/HARNESS_BACKLOG.md` | Skip | Should if friction repeats | Must if changing harness |
| Relevant `docs/decisions/` | Skip | Should | Must |

### Implementation Phase

Scope to files directly affecting the task.

| Document / Source | Tiny | Normal | High-Risk |
|---|---|---|---|
| Files being changed | Must | Must | Must |
| Adjacent files with same pattern | Should | Must | Must |
| Relevant task file | Skip if no task | Must | Must |
| `CLAUDE.md` architecture section | Skip | Should for structural changes | Must |
| Native bridge docs (`docs/HARNESS.md` MethodChannel section) | Skip | Should if touched | Must |
| `docs/FEATURE_INTAKE.md` | Skip | Skip | Should |

### Validation Phase

Prove the change. Do not claim completion without running checks.

| Document / Source | Tiny | Normal | High-Risk |
|---|---|---|---|
| Task acceptance criteria | Should | Must | Must |
| `docs/TEST_MATRIX.md` | Should | Must | Must |
| `CLAUDE.md` commands section | Should | Must | Must |
| Flutter test output | Should | Must | Must |
| mobile-mcp screenshot (UI changes) | Skip if no UI | Must for UI changes | Must |

### Trace Phase (After-Work Note)

Leave useful evidence in task file before session ends.

| What to record | Tiny | Normal | High-Risk |
|---|---|---|---|
| `Done` summary | Must | Must | Must |
| `Files changed` list | Must | Must | Must |
| `Risks/Blockers` | Should | Must | Must |
| `token_estimate` | Skip | Should | Must |
| `harness_friction` | Should | Must | Must |

## Retrieval Triggers

| Trigger | Action |
|---|---|
| Task touches MethodChannel / native bridge | Read `CLAUDE.md` Native Bridge section + `lib/config/module_bus/` before planning |
| Task touches BLoC state / events | Read adjacent BLoC files + `base_bloc_module` pattern before implementing |
| Task touches DI (GetIt) | Read `lib/di/injection_container.dart` before implementing |
| Task touches routing (GoRouter) | Read `lib/routes/go_router.dart` + module's `routes/` before implementing |
| Task changes public API / entity shape | Read all consumers of that entity before editing |
| Task touches auth, payment, or sensitive data | Treat as high-risk, check `docs/decisions/` before implementing |
| Task discovers repeated confusion or stale docs | Record `harness_friction` in After-Work note, add to `docs/HARNESS_BACKLOG.md` |
| UI changes on Flutter | Use mobile-mcp for screenshot verification after `flutter test` passes |
| App variant behavior (DGO/DSTOCK) | Read `lib/config/app_config.dart` + `CLAUDE.md` App Variants section |

## Token Budget Guidance

| Lane | Target Harness Context | Read Shape |
|---|---|---|
| Tiny | ~2K tokens | `AGENTS.md`, `FEATURE_INTAKE.md`, task file, exact file being changed |
| Normal | ~5K tokens | Intake docs, relevant task, TEST_MATRIX, architecture when structural |
| High-Risk | ~10K tokens | Full intake, CLAUDE.md, decisions, templates, TEST_MATRIX, all affected modules |

Budget rules:
- Prefer targeted `grep`/`find` over bulk `cat` on large files.
- Read smallest section that answers current phase question.
- Escalate context when retrieval trigger fires.
- Stop reading unrelated history after lane, affected files, and validation path are clear.

## Additive Behavior

These rules do not replace `AGENTS.md`. Read the stable entrypoint docs listed in `AGENTS.md` first, then use this document to decide what to retrieve based on phase, lane, and triggers.

## Review Checklist

Before implementation:
- [ ] Lane chosen from `docs/FEATURE_INTAKE.md`
- [ ] Relevant task file identified or created
- [ ] High-risk trigger handled if applicable

Before final response:
- [ ] Validation evidence collected (`flutter test`, mobile-mcp if UI)
- [ ] After-Work note written to task file with files_changed + friction
