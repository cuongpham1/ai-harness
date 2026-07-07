# Documentation Map

This directory holds the AI Harness operating model and templates installed into
target projects.

## Main Files

- `HARNESS.md`: hybrid collaboration model (Claude Code + Cursor + durable layer).
- `CURSOR.md`: Cursor hooks, rules, and subagent setup (full parity).
- `TOKEN_EFFICIENCY.md`: RTK, caveman, compact, lane pipeline token savings.
- `MCP_SETUP.md`: MCP config for Cursor vs Claude Code.
- `FEATURE_INTAKE.md`: tiny, normal, and high-risk work classification.
- `CONTEXT_RULES.md`: phase-by-lane context retrieval rules.
- `ARCHITECTURE.md`: harness installer architecture (this repo) + target-project guidance.
- `TEST_MATRIX.md`: legacy proof map; prefer `scripts/bin/harness-cli query matrix`.
- `FRICTION_REVIEW.md`: friction-to-backlog review protocol (H3).
- `HARNESS_BACKLOG.md`: legacy improvement list; prefer `scripts/bin/harness-cli backlog`.
- `TRACE_SPEC.md`: trace quality tiers for `harness-cli trace` and `score-trace`.
- `HARNESS_COMPONENTS.md`: responsibility taxonomy and coverage map.
- `HARNESS_MATURITY.md`: H0–H5 maturity ladder.
- `GLOSSARY.md`: shared terms.

## Folders

- `product/`: product contract files (populated from target project spec).
- `stories/`: durable story packets and backlog.
- `decisions/`: ADRs including hybrid model (`0006-hybrid-claude-code-harness.md`).
- `demo/`: walkthrough of spec → stories → validation flow.
- `templates/`: spec-intake, story, high-risk-story, decision, validation, task formats.

## Durable Layer

Operational records live in `harness.db` (gitignored), managed by
`scripts/bin/harness-cli`. Schema: `scripts/schema/`. See `scripts/README.md`.

## Upstream

Docs and CLI track [repository-harness](https://github.com/hoangnb24/repository-harness).
Update with:

```bash
bash scripts/install-harness.sh --merge --yes
```

Use `--merge` only; preserves `.claude/`, hooks, and custom `AGENTS.md` content
outside the `<!-- HARNESS:BEGIN -->` block.
