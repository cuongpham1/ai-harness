# 0006 Hybrid Claude Code + harness-experimental

Date: 2026-06-01

## Status

Accepted

## Context

AI Harness (`ai-harness`) predates the durable layer in
[harness-experimental](https://github.com/hoangnb24/harness-experimental). It
already ships Claude Code agents, hooks, HUD, knowledge graph, and
`.project-manager/` task tracking.

harness-experimental Phase 2/3 adds SQLite records, trace scoring, maturity
taxonomy, and a Rust CLI. Installing both systems without integration would
duplicate task tracking and confuse agents.

## Decision

Adopt a **hybrid model**:

| Concern | Primary system |
| --- | --- |
| Session handoff, PM pipeline, hook enforcement | `.project-manager/tasks/` + Claude Code agents |
| Durable story rows, proof matrix, backlog, scored traces | `scripts/bin/harness-cli` + `harness.db` |
| Session telemetry | `kg/` (hooks) — complements CLI traces |

Rules:

1. Every implementation task still uses `.project-manager/tasks/` and the
   `@coder → @spec-reviewer → @reviewer → @tester` pipeline.
2. Normal and high-risk work also records `harness-cli intake` and `harness-cli
   trace` per `docs/TRACE_SPEC.md`.
3. `install.sh` distributes the full hybrid payload including CLI binary download.
4. `scripts/install-harness.sh --merge` updates harness-experimental docs/CLI
   without overwriting `.claude/` or hooks.
5. Do not `--override` on projects that already have AI Harness installed.

## Consequences

Positive:

- Agents get hook-enforced handoff plus queryable durable records.
- ai-harness stays aligned with upstream harness-experimental releases.
- Target projects can adopt CLI traces incrementally.

Negative:

- Two places may describe the same story until teams sync task files with
  `harness-cli story`.
- Installer must download platform-specific CLI binaries.

## Verification

```bash
test -x scripts/bin/harness-cli && scripts/bin/harness-cli query stats
test -f docs/HARNESS.md && test -f .claude/agents/pm.md
```
