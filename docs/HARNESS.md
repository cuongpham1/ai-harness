# Harness

This repo uses a **hybrid harness**: [harness-experimental](https://github.com/hoangnb24/harness-experimental) patterns (intake, durable layer, trace scoring) plus a **Claude Code agent pipeline** (`.claude/`, `.project-manager/`, hooks, HUD, knowledge graph).

The app is what users touch. The harness is what agents touch.

## Mental model

```text
Human intent
  → Feature intake (docs/FEATURE_INTAKE.md + harness-cli intake)
  → Task in .project-manager/tasks/ (+ docs/stories/ for durable story packets)
  → Agent pipeline (coder → spec-reviewer → reviewer → tester)
  → Product delta (target project code)
  → Validation proof (TEST_MATRIX / harness-cli query matrix)
  → Trace + backlog (harness-cli trace, score-trace)
  → Decisions (docs/decisions/, harness-cli decision)
```

Every task has two possible outputs:

1. **Product delta** — application code, tests, API shape, product docs.
2. **Harness delta** — docs, templates, validation expectations, backlog items, decision records, or trace evidence that make the next task easier.

## Harness v0 scope (this repo)

Includes:

- Agent entrypoint (`AGENTS.md` shim + Claude Code agents).
- Feature intake and risk lanes.
- Story and task templates (`.project-manager/tasks/`, `docs/stories/`).
- Decision records (`docs/decisions/`).
- Durable layer: SQLite (`harness.db`) + Rust CLI (`scripts/bin/harness-cli`).
- Hooks, HUD, knowledge graph for Claude Code sessions.
- Benchmark scaffold (`benchmark/`).

Excludes from the installer payload:

- Target-project application source.
- Target-project CI and test runner config (added when stories need them).

## Durable layer

Policy documents describe how to work. The durable layer stores what happened.

Operational data — intake classifications, story status, decision outcomes, backlog items, and execution traces — lives in SQLite (`harness.db`) managed by `scripts/bin/harness-cli`. The database is local to each project instance and gitignored. Schema is version-controlled under `scripts/schema/`.

Initialize if needed:

```bash
scripts/bin/harness-cli init
scripts/bin/harness-cli import brownfield   # seed from existing markdown (optional)
```

Common commands:

```bash
scripts/bin/harness-cli intake  --type <type> --summary <text> --lane <lane>
scripts/bin/harness-cli story   add --id <id> --title <text> --lane <lane>
scripts/bin/harness-cli story   update --id <id> --status <status>
scripts/bin/harness-cli trace   --summary <text> --outcome <outcome>
scripts/bin/harness-cli score-trace
scripts/bin/harness-cli query   matrix
scripts/bin/harness-cli query   backlog
scripts/bin/harness-cli query   friction
scripts/bin/harness-cli query   stats
```

See [TRACE_SPEC.md](TRACE_SPEC.md) for trace quality tiers.

## Unified task + trace model

**Single source of truth:** structured `### After-Work` in `.project-manager/tasks/*.md`.

| Layer | Role |
| --- | --- |
| Task file | Human/agent handoff, AC, scope, After-Work (hooks enforce) |
| `harness-cli` + `harness.db` | Durable query layer — synced automatically on session Stop |
| `kg/traces/` | Subagent JSONL telemetry (optional, complements CLI) |

Flow:

```text
Agent appends After-Work → check-task-handoff validates → sync-harness-trace → harness.db
```

For cross-session story history, also use `docs/stories/` + `harness-cli story` on normal/high-risk work.

## Source hierarchy

```text
README.md + target-project architecture doc (e.g. CLAUDE.md)
  → stack-specific architecture and commands

.project-manager/tasks/*.md
  → active work, acceptance criteria, after-work evidence

docs/product/*
  → product contract (when derived from a spec)

docs/stories/*
  → durable story packets

scripts/bin/harness-cli query matrix
  → behavior-to-proof control panel

docs/decisions/*
  → durable “why” when behavior or harness rules change

kg/runtime/ + kg/traces/
  → Claude Code session state (complements CLI traces)
```

## Task loop

For every implementation request:

1. Classify with [FEATURE_INTAKE.md](FEATURE_INTAKE.md) → lane: **tiny**, **normal**, or **high-risk**.
2. Record classification: `scripts/bin/harness-cli intake` (normal/high-risk).
3. Create or update `.project-manager/tasks/<id>.md` using [templates/task.md](templates/task.md).
4. PM delegates to `@coder` (never implement large changes without a task).
5. Check proof: `scripts/bin/harness-cli query matrix` or [TEST_MATRIX.md](TEST_MATRIX.md).
6. Run stack validation before claiming done (see target project README).
7. Append **After-Work** to the task file.
8. Record trace: `scripts/bin/harness-cli trace` per [TRACE_SPEC.md](TRACE_SPEC.md); run `score-trace` for normal/high-risk.
9. Record architecture changes in `docs/decisions/` or `harness-cli decision add`.

## Growth rule

When an agent is confused, repeats manual reasoning, or discovers missing proof:

```bash
scripts/bin/harness-cli backlog add \
  --title "short name" \
  --pain "what was hard" \
  --predicted "metric or behavior expected to improve"
```

When the improvement is shipped, close with measured evidence:

```bash
scripts/bin/harness-cli backlog close \
  --id N \
  --outcome "measured result, e.g. trace tier avg 2.0→2.6, compliance 82%→91%"
```

Review open vs closed items:

```bash
scripts/bin/harness-cli query backlog --open
scripts/bin/harness-cli query backlog --closed
```

This is the **backlog outcome loop** (see [GLOSSARY.md](GLOSSARY.md)). Compare predicted impact at creation with actual outcome at close so the harness learns from its own changes.

Also capture friction in traces and After-Work notes (tag format in [FRICTION_REVIEW.md](FRICTION_REVIEW.md)):

```bash
scripts/bin/harness-cli query friction
node scripts/friction-by-component.mjs
```

## Harness change policy

Agents may update directly:

- Story status and evidence via `harness-cli story update`.
- Intake, traces, backlog items via `harness-cli`.
- Task files, test matrix rows, small doc clarifications tied to the current task.

Agents should ask for human confirmation before:

- Changing architecture direction.
- Removing validation requirements.
- Changing source-of-truth hierarchy or risk classification rules.

## Done definition

A task is done only when:

- Acceptance criteria are met or blockers are documented.
- Relevant validation was run (stack-specific; see target project).
- Task status updated in `.project-manager/tasks/`.
- Trace recorded for normal/high-risk work (`harness-cli trace` + `score-trace`).
- Missing harness capabilities recorded via backlog or `docs/HARNESS_BACKLOG.md`.
- No secrets committed.

## Installing into a target project

```bash
bash install.sh /path/to/project
```

For harness-experimental docs/CLI only (merge mode, preserves existing `.claude/`):

```bash
bash scripts/install-harness.sh --merge --yes --directory /path/to/project
```

Upstream reference: [harness-experimental](https://github.com/hoangnb24/harness-experimental).
