# Context Engineering Rules

Context rules help agents decide what to read, when to read it, and when to stop reading. Additive to the stable `AGENTS.md` reading list.

Goal: put the right information in the model for the current task phase and risk lane — not maximize context.

## Context Phases

### Intake Phase

Read to classify request, find affected surface, choose lane.

| Document / Source | Tiny | Normal | High-Risk |
| --- | --- | --- | --- |
| `AGENTS.md` | Must | Must | Must |
| `docs/FEATURE_INTAKE.md` | Must | Must | Must |
| `.project-manager/README.md` | Must | Must | Must |
| `scripts/bin/harness-cli query matrix` | Should | Must | Must |
| `docs/HARNESS.md` | Should | Must | Must |
| `docs/ARCHITECTURE.md` | Skip | Should | Must |
| Target architecture doc (e.g. `CLAUDE.md`) | Skip | Should | Must |
| Relevant `.project-manager/tasks/` | Skip if unrelated | Must if task exists | Must |
| Relevant `docs/stories/*` | Skip if unrelated | Must if story exists | Must |
| `docs/decisions/*` | Skip | Should if architecture touched | Must |
| `docs/HARNESS_COMPONENTS.md` | Skip | Should for harness work | Must for observability/benchmark |

### Planning Phase

Read to decide smallest safe approach and expected proof.

| Document / Source | Tiny | Normal | High-Risk |
| --- | --- | --- | --- |
| Files to edit | Must | Must | Must |
| `docs/templates/task.md` | Skip | Must when creating task | Should |
| `docs/templates/story.md` | Skip | Must when creating story | Should |
| `docs/templates/high-risk-story/*` | Skip | Skip unless escalated | Must |
| `docs/TEST_MATRIX.md` or `harness-cli query matrix` | Should | Must | Must |
| `docs/HARNESS_BACKLOG.md` / `harness-cli query backlog` | Skip | Should if friction repeats | Must if changing harness |
| Relevant `docs/decisions/` | Skip | Should | Must |
| `docs/HARNESS_MATURITY.md` | Skip | Should for harness improvements | Must for maturity claims |

### Implementation Phase

Scope to files directly affecting the task.

| Document / Source | Tiny | Normal | High-Risk |
| --- | --- | --- | --- |
| Files being changed | Must | Must | Must |
| Adjacent files with same pattern | Should | Must | Must |
| Relevant task file | Skip if no task | Must | Must |
| Relevant story packet | Skip if no story | Must | Must |
| Target stack docs | Skip | Should for structural changes | Must |
| Unrelated docs and historical traces | Skip | Skip | Should only if they affect decisions |

### Validation Phase

Prove the change. Do not claim completion without running checks.

| Document / Source | Tiny | Normal | High-Risk |
| --- | --- | --- | --- |
| Task acceptance criteria | Should | Must | Must |
| `docs/TEST_MATRIX.md` or `harness-cli query matrix` | Should | Must | Must |
| `docs/templates/validation-report.md` | Skip | Should for notable proof | Must for high-risk |
| Target project validation commands | Should | Must | Must |
| `benchmark/` protocol | Skip | Skip unless requested | Must if story depends on it |

### Trace Phase

After-Work in task files is the source of truth. Stop hook syncs to `harness.db`.

| Document / Source | Tiny | Normal | High-Risk |
| --- | --- | --- | --- |
| Structured `### After-Work` in task file | Must | Must | Must |
| `docs/TRACE_SPEC.md` | Should | Must | Must |
| `scripts/hooks/sync-harness-trace.mjs` | Auto on Stop | Auto on Stop | Auto on Stop |
| `scripts/bin/harness-cli query stats` | Skip | Should | Must |

## Retrieval Triggers

| Trigger | Action |
| --- | --- |
| Task touches durable layer, schema, or CLI | Read `docs/decisions/0004-sqlite-durable-layer.md`, `docs/decisions/0005-prebuilt-rust-harness-cli.md`, `scripts/schema/`, `scripts/README.md` |
| Task touches installer or merge/override behavior | Read `scripts/install-harness.sh`, `install.sh`, `docs/decisions/0006-hybrid-claude-code-harness.md` |
| Task touches auth, security, data loss, or external providers | Treat as high-risk; read `docs/templates/high-risk-story/*` and prior decisions |
| Task changes public API or user-visible workflow | Read relevant `docs/product/*`, story packets, validation expectations |
| Task changes harness policy or risk rules | Read `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/decisions/*`; pause if ambiguous |
| Task discovers repeated confusion or stale docs | Record friction in trace/backlog; add `harness-cli backlog add` when out of scope |
| Task makes maturity, observability, or benchmark claim | Read `docs/HARNESS_COMPONENTS.md`, `docs/HARNESS_MATURITY.md`, `docs/TRACE_SPEC.md` |
| Normal/high-risk work spans multiple sessions | Keep `.project-manager/tasks/` and `docs/stories/` current |
| Final response being prepared | Re-read validation evidence, `git status --short`, `docs/TRACE_SPEC.md` |

## Token Budget Guidance

| Lane | Target Harness Context | Read Shape |
| --- | --- | --- |
| Tiny | ~2K tokens | `AGENTS.md`, `FEATURE_INTAKE.md`, task file, exact file being changed |
| Normal | ~5K tokens | Intake docs, task/story, matrix query, architecture when structural, trace spec at end |
| High-Risk | ~10K tokens | Full intake, architecture, decisions, high-risk templates, validation docs, component/maturity docs |

Budget rules:

- Prefer targeted search over bulk reading.
- Read the smallest section that answers the current phase question.
- Escalate context when a retrieval trigger fires.
- Stop reading unrelated history after lane, affected files, and validation path are clear.

## Additive Behavior

These rules do not replace `AGENTS.md`. Read the stable entrypoint docs listed in `AGENTS.md` first, then use this document based on phase, lane, and triggers.

## Review Checklist

Before implementation:

- [ ] Lane chosen from `docs/FEATURE_INTAKE.md`
- [ ] Relevant task file and/or story packet identified
- [ ] High-risk trigger handled if applicable

Before final response:

- [ ] Validation evidence collected
- [ ] After-Work note written to task file
- [ ] Trace recorded per `docs/TRACE_SPEC.md` for normal/high-risk work
