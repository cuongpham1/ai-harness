# Harness

This repo uses a **hybrid harness**: [harness-experimental](https://github.com/hoangnb24/harness-experimental) patterns for intake and proof, plus an existing **Claude Code agent pipeline** (`.claude/`, `.project-manager/`).

The app is what users touch. The harness is what agents touch.

## Mental model

```text
Human intent
  → Feature intake (docs/FEATURE_INTAKE.md)
  → Task in .project-manager/tasks/
  → Agent pipeline (coder → spec-reviewer → reviewer → tester)
  → Product delta (lib/, test/, integration_test/)
  → Validation proof (docs/TEST_MATRIX.md)
  → Decisions / after-work notes (.project-manager/decisions.md, task file)
```

Every task has two possible outputs:

1. **Product delta** — Dart code, tests, routes, l10n, native contract docs.
2. **Harness delta** — intake rules, test matrix rows, task templates, explore prompts, conventions.

## Source hierarchy

```text
CLAUDE.md + README_INTEGRATION.md
  → architecture and native bridge contract

.project-manager/conventions.md
  → coding rules agents must follow

.project-manager/tasks/*.md
  → story-sized work + acceptance criteria + after-work evidence

docs/TEST_MATRIX.md
  → which behaviors require which proof

docs/decisions/ (optional ADRs)
  → durable “why” when behavior or architecture changes
```

## Task loop

For every implementation request:

1. Classify with [FEATURE_INTAKE.md](FEATURE_INTAKE.md) → lane: **tiny**, **normal**, or **high-risk**.
2. Create or update `.project-manager/tasks/<id>.md` using [templates/task.md](templates/task.md).
3. PM delegates to `@coder` (never implement large changes in one shot without a task).
4. Run proof from [TEST_MATRIX.md](TEST_MATRIX.md) before claiming done.
5. Append **After-Work** to the task file (agent, files, decisions, risks).
6. Record architecture changes in `.project-manager/decisions.md` or `docs/decisions/ADR-*.md`.

## Done definition

A task is done only when:

- Acceptance criteria are met or blockers are documented.
- `flutter analyze` passes (and `flutter test` for touched areas).
- TEST_MATRIX proof for the affected behaviors was run or explicitly waived.
- Task status and AC checkboxes updated in `.project-manager/tasks/`.
- No secrets committed.

## Harness growth

When an agent repeats the same mistake, lacks proof, or UAT finds a recurring bug (e.g. empty `report.md`, form not tappable):

- Add a TEST_MATRIX row or tighten explore prompt in `scripts/ai_test/explore_prompt.md`.
- Add a backlog item in `.project-manager/README.md` **Known Issues**.
- Optionally file `docs/decisions/ADR-*.md` for structural fixes.

## What we did not install from harness-experimental

- `scripts/bin/harness-cli` / SQLite `harness.db` — optional later; markdown + PM hooks are enough for now.
- Empty `docs/product/` — product contract lives in module code + `README_INTEGRATION.md` + tasks.

To add the CLI later (traces, backlog queries):

```bash
curl -fsSL "https://raw.githubusercontent.com/hoangnb24/harness-experimental/main/scripts/install-harness.sh?$(date +%s)" | bash -s -- --merge --yes
```

Use `--merge` only; do not `--override` (preserves `.claude/`, hooks, `scripts/ai_test/`).
