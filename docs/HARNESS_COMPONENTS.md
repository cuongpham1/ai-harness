# Harness Components

This taxonomy maps the `ai-harness` fork (built on `harness-experimental`) to
two component frameworks used by Phase 2 and updated by Phase 3 active
observability work. It reflects the current state including local-only
extensions: 11 specialist subagents, enforced hook gates, skill installer, and
runtime substrate coverage.

- Runtime Substrate responsibilities: the 11 responsibility areas the harness
  should cover.
- NexAU decomposition: the seven implementation surfaces that influence agent
  behavior.

Status values:

- **Covered**: the repository has an explicit file, command, or record for this
  responsibility.
- **Partial**: the repository has some support, but the support is incomplete,
  manual, or not yet measured.
- **Missing**: no meaningful support exists yet.

## Responsibility Map

| # | Responsibility | Status | Harness Files | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| 1 | Task specification | Covered | `AGENTS.md`, `docs/FEATURE_INTAKE.md`, `docs/templates/story.md`, `docs/templates/spec-intake.md`, `docs/templates/high-risk-story/*`, `docs/stories/*`, `intake` table, `story` table | Requests are classified by type and lane before implementation; normal and high-risk work have templates and durable story rows. | Keep story packets synchronized with future product docs. |
| 2 | Context selection | Covered | `AGENTS.md`, `docs/CONTEXT_RULES.md`, `docs/ARCHITECTURE.md`, `docs/decisions/*`, `docs/product/README.md` | Phase 2 adds phase-by-lane context rules and retrieval triggers while preserving the stable entry list in `AGENTS.md`. | Future automation could enforce context selection or measure over-reading. |
| 3 | Tool access | Covered | `scripts/bin/harness-cli`, `scripts/README.md`, `crates/harness-cli/*`, `scripts/install-harness.sh`, `scripts/build-harness-cli-release.sh`, `scripts/hooks/block-dangerous-bash.js`, `scripts/hooks/guard-commit.js`, `scripts/hooks/content-guard.mjs`, `scripts/hooks/pre-tool-content-guard.mjs`, `.claude/settings.json` (hook wiring, 43 hook references) | Harness CLI exposes operational commands (intake, stories, decisions, backlog, traces, trace scoring, queries); runtime policy gates enforced via PreToolUse and PreToolCommit hooks block dangerous shell and git operations. | Machine-readable tool registry and capability manifest remain future work. |
| 4 | Project memory | Covered | `docs/HARNESS.md`, `docs/decisions/*`, `docs/GLOSSARY.md`, `docs/HARNESS_BACKLOG.md`, `docs/stories/*`, `harness.db`, `decision`, `backlog`, and `trace` tables | Decisions, backlog, stories, and traces preserve durable knowledge across tasks. | Future work should add staleness checks and summarize old traces. |
| 5 | Task state | Covered | `scripts/bin/harness-cli query matrix`, `docs/TEST_MATRIX.md`, `intake` table, `story` table, `trace` table | Durable records track intake, story status, proof columns, and task traces. | Add lifecycle checks so in-progress stories cannot be forgotten. |
| 6 | Observability | Covered | `docs/TRACE_SPEC.md`, `trace` table, `scripts/bin/harness-cli score-trace`, `scripts/hooks/score-trace-after-sync.mjs`, `scripts/friction-by-component.mjs`, `benchmark/PROTOCOL.md`, `benchmark/compare.mjs` | Traces scored automatically after sync; friction grouped by component; benchmark compares runs. | Extend agent-task benchmark when live CLI available. |
| 7 | Failure attribution | Covered | `docs/FRICTION_REVIEW.md`, `docs/HARNESS_COMPONENTS.md`, `scripts/friction-by-component.mjs`, `benchmark/compare.mjs` | Friction tags map to responsibilities; compare output attributes regressions. | Keyword attribution may need refinement at scale. |
| 8 | Verification | Covered | `docs/TEST_MATRIX.md`, `scripts/bin/harness-cli query matrix`, `scripts/bin/harness-cli score-trace`, `story` proof columns, `.github/workflows/harness-cli-release.yml`, `docs/templates/validation-report.md`, `scripts/hooks/run-harness-verify.mjs` (automated story verification), `scripts/hooks/batch-verify.mjs` (batch proof validation), `benchmark/run-harness.mjs` (harness test runner) | Stories record proof columns; trace quality checked mechanically; release workflow verifies CLI builds; hooks provide automated verification runners for stories and batch proof validation. | Continuous verification at scale and integration with CI/CD pipelines remain future work. |
| 9 | Permissions | Covered | `AGENTS.md`, `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/ARCHITECTURE.md`, installer conflict handling in `scripts/install-harness.sh`, `.claude/agents/pm.md` (PM contract + role boundaries), `scripts/hooks/guard-commit.js` (blocks subagent commit/push), `scripts/hooks/check-task-handoff.js` (verifies task routing), `.claude/settings.json` (disallowedTools enforcement per agent) | Policy describes role boundaries and agent responsibilities; enforcement layer gates tool access per agent profile (disallowedTools in agent definitions) and runtime hooks prevent escalations. | Continuous audit of permission drift remains future work. |
| 10 | Entropy auditing | Covered | `docs/FRICTION_REVIEW.md`, `docs/HARNESS_BACKLOG.md`, `backlog` table, `scripts/friction-by-component.mjs`, `docs/HARNESS_MATURITY.md` | Friction review protocol, predicted/outcome backlog loop, benchmark compare. | Drift detector and stale-doc audit remain future work. |
| 11 | Intervention recording | Covered | `trace` table, `docs/decisions/*`, `docs/stories/*`, `docs/HARNESS.md`, `docs/proposals/`, `scripts/apply-proposal.sh` | Traces and decisions record actions; H5 proposal lifecycle (draft → approved → applied → outcome) provides structured intervention recording with outcome comparison. | Review-event schema for separating human vs agent interventions remains future work. |

## NexAU Cross-Reference

| Component | Harness Equivalent | Status | Notes |
| --- | --- | --- | --- |
| System prompts | `AGENTS.md` plus Harness policy docs | Covered | `AGENTS.md` is the stable shim; `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, and `docs/CONTEXT_RULES.md` carry evolving operating instructions. |
| Tool descriptions | `scripts/README.md`, `docs/HARNESS.md`, `docs/TRACE_SPEC.md`, CLI help from `crates/harness-cli/src/interface.rs` | Partial | Commands and trace scoring are documented, but there is no standalone tool schema or generated command reference. |
| Tool implementations | `scripts/bin/harness-cli`, `crates/harness-cli/*`, `scripts/schema/001-init.sql` | Covered | The Rust CLI is the primary durable-layer implementation and stable repo-local entrypoint. |
| Middleware | installer safety logic, feature intake workflow | Partial | The installer and intake process mediate work, but there is no runtime middleware enforcing policies. |
| Skills | `docs/templates/*`, `docs/FEATURE_INTAKE.md`, `docs/CONTEXT_RULES.md`, `docs/TRACE_SPEC.md`, `frameworks/*`, `scripts/install-skills.sh` | Covered | Reusable procedures documented in markdown templates; harness includes framework skill registry and installer (`.sh`) to distribute language-specific procedures; multiple framework profiles available in `frameworks/` directory. |
| Sub-agents | `.claude/agents/` directory (11 specialist agents) | Covered | Harness ships with 11 pre-configured specialist agents: `pm` (orchestrator), `coder`, `reviewer`, `tester`, `doc-writer`, `explorer`, `planner`, `product-analyst`, `spec-reviewer`, `debugger`, `solution-architect`. PM contract in `.claude/agents/pm.md` defines routing and delegation protocol; each agent has explicit role, disallowed tools, and model assignment. |
| Long-term memory | `harness.db`, `docs/decisions/*`, `docs/stories/*`, `docs/HARNESS_BACKLOG.md`, `docs/GLOSSARY.md` | Covered | Durable records and markdown decisions preserve task history and project vocabulary. |

## File Inventory

Every tracked project file plus the Phase 2 input file is mapped to at least
one Runtime Substrate responsibility.

| File | Primary Responsibility | Secondary Responsibilities |
| --- | --- | --- |
| `.gitignore` | Tool access | Task state |
| `AGENTS.md` | Context selection | Task specification, permissions |
| `README.md` | Task specification | Project memory |
| `CONTRIBUTING.md` | Intervention recording | Project memory |
| `Cargo.toml` | Tool access | Verification |
| `Cargo.lock` | Tool access | Verification |
| `PHASE2.md` | Task specification | Observability, context selection |
| `PHASE3.md` | Task specification | Observability, verification, entropy auditing |
| `crates/harness-cli/Cargo.toml` | Tool access | Verification |
| `crates/harness-cli/src/main.rs` | Tool access | Tool implementation |
| `crates/harness-cli/src/domain.rs` | Tool access | Task state, verification |
| `crates/harness-cli/src/application.rs` | Tool access | Task state |
| `crates/harness-cli/src/infrastructure.rs` | Tool access | Project memory, task state, observability |
| `crates/harness-cli/src/interface.rs` | Tool access | Context selection, verification |
| `docs/ARCHITECTURE.md` | Permissions | Context selection, task specification |
| `docs/FEATURE_INTAKE.md` | Task specification | Permissions, context selection |
| `docs/GLOSSARY.md` | Project memory | Context selection |
| `docs/HARNESS.md` | Task specification | Project memory, task state, permissions |
| `docs/HARNESS_BACKLOG.md` | Entropy auditing | Project memory, failure attribution |
| `docs/HARNESS_COMPONENTS.md` | Failure attribution | Observability, entropy auditing |
| `docs/HARNESS_MATURITY.md` | Entropy auditing | Observability, verification |
| `docs/CONTEXT_RULES.md` | Context selection | Permissions, task specification |
| `docs/TRACE_SPEC.md` | Observability | Failure attribution, intervention recording |
| `docs/README.md` | Project memory | Context selection |
| `docs/TEST_MATRIX.md` | Verification | Task state |
| `docs/decisions/0001-harness-first-development.md` | Project memory | Permissions |
| `docs/decisions/0002-post-spec-product-lifecycle.md` | Project memory | Task specification |
| `docs/decisions/0003-generic-spec-intake-harness.md` | Project memory | Task specification |
| `docs/decisions/0004-sqlite-durable-layer.md` | Project memory | Observability, task state |
| `docs/decisions/0005-prebuilt-rust-harness-cli.md` | Project memory | Tool access |
| `docs/decisions/README.md` | Project memory | Context selection |
| `docs/demo/README.md` | Task specification | Project memory |
| `docs/product/README.md` | Task specification | Project memory |
| `docs/review-fixes-1d30bf62-to-main.md` | Intervention recording | Failure attribution, verification |
| `docs/stories/README.md` | Task specification | Project memory |
| `docs/stories/US-001-install-harness.md` | Task specification | Verification, intervention recording |
| `docs/stories/US-008-trace-quality-scoring.md` | Task specification | Observability, verification |
| `docs/stories/US-009-enriched-friction-query.md` | Task specification | Failure attribution, observability |
| `docs/stories/US-011-backlog-outcome-workflow.md` | Task specification | Entropy auditing, project memory |
| `docs/stories/backlog.md` | Task specification | Project memory |
| `docs/stories/epics/README.md` | Task specification | Project memory |
| `docs/stories/epics/E01-durable-layer/US-002-rust-harness-cli/overview.md` | Task specification | Project memory |
| `docs/stories/epics/E01-durable-layer/US-002-rust-harness-cli/design.md` | Task specification | Tool access, permissions |
| `docs/stories/epics/E01-durable-layer/US-002-rust-harness-cli/execplan.md` | Task specification | Verification, task state |
| `docs/stories/epics/E01-durable-layer/US-002-rust-harness-cli/validation.md` | Verification | Intervention recording |
| `docs/stories/epics/E02-phase-2-observability-taxonomy/phase-2-progress.md` | Task state | Intervention recording |
| `docs/templates/decision.md` | Project memory | Task specification |
| `docs/templates/spec-intake.md` | Task specification | Context selection |
| `docs/templates/story.md` | Task specification | Verification |
| `docs/templates/validation-report.md` | Verification | Intervention recording |
| `docs/templates/high-risk-story/overview.md` | Task specification | Context selection |
| `docs/templates/high-risk-story/design.md` | Task specification | Permissions |
| `docs/templates/high-risk-story/execplan.md` | Task state | Verification |
| `docs/templates/high-risk-story/validation.md` | Verification | Failure attribution |
| `scripts/README.md` | Tool access | Context selection |
| `scripts/bin/harness-cli` | Tool access | Task state, observability |
| `scripts/bin/harness-cli` | Tool access | Task state, observability |
| `scripts/install-harness.sh` | Tool access | Permissions |
| `scripts/build-harness-cli-release.sh` | Verification | Tool access |
| `scripts/schema/001-init.sql` | Task state | Observability, project memory |
| `.github/ISSUE_TEMPLATE/agent-failure-case.md` | Failure attribution | Entropy auditing |
| `.github/ISSUE_TEMPLATE/pattern-request.md` | Entropy auditing | Intervention recording |
| `.github/ISSUE_TEMPLATE/real-world-example.md` | Project memory | Intervention recording |
| `.github/workflows/harness-cli-release.yml` | Verification | Tool access |
| `.claude/agents/pm.md` | Permissions | Task specification, intervention recording |
| `.claude/agents/coder.md` | Permissions | Task specification |
| `.claude/agents/reviewer.md` | Permissions | Verification, failure attribution |
| `.claude/agents/tester.md` | Permissions | Verification, task state |
| `.claude/agents/doc-writer.md` | Permissions | Project memory, task specification |
| `.claude/agents/explorer.md` | Permissions | Context selection, failure attribution |
| `.claude/agents/planner.md` | Permissions | Task specification |
| `.claude/agents/product-analyst.md` | Permissions | Task specification, context selection |
| `.claude/agents/spec-reviewer.md` | Permissions | Verification, task specification |
| `.claude/agents/debugger.md` | Permissions | Verification, failure attribution |
| `.claude/agents/solution-architect.md` | Permissions | Context selection, task specification |
| `scripts/hooks/block-dangerous-bash.js` | Tool access | Permissions |
| `scripts/hooks/guard-commit.js` | Permissions | Tool access |
| `scripts/hooks/content-guard.mjs` | Tool access | Permissions |
| `scripts/hooks/pre-tool-content-guard.mjs` | Tool access | Permissions |
| `scripts/hooks/check-task-handoff.js` | Permissions | Intervention recording |
| `scripts/hooks/run-harness-verify.mjs` | Verification | Task state, observability |
| `scripts/hooks/batch-verify.mjs` | Verification | Task state |
| `scripts/hooks/auto-checkpoint.js` | Observability | Project memory |
| `scripts/hooks/hud-agent-track.mjs` | Observability | Task state |
| `scripts/hooks/post-tool-task-tracker.js` | Observability | Task state |
| `scripts/hooks/score-trace-after-sync.mjs` | Observability | Failure attribution |
| `scripts/hooks/subagent-log.js` | Observability | Intervention recording |
| `scripts/hooks/subagent-start-bundle.mjs` | Observability | Task state |
| `scripts/hooks/sync-harness-trace.mjs` | Observability | Project memory |
| `scripts/hooks/sync-harness-story.mjs` | Project memory | Task state |
| `scripts/hooks/trace-logger.mjs` | Observability | Project memory |
| `scripts/hooks/post-commit-archaeologist.js` | Failure attribution | Observability |
| `scripts/hooks/suggest-compact.js` | Entropy auditing | Observability |
| `scripts/hooks/update-pm-readme.js` | Project memory | Task state |
| `scripts/hooks/session-start-pm.js` | Project memory | Task state |
| `scripts/hud/index.mjs` | Observability | Task state |
| `scripts/hud/render.mjs` | Observability | Task state |
| `scripts/hud/config.mjs` | Observability | Task state |
| `scripts/hud/quota-api.mjs` | Observability | Task state |
| `scripts/hud/state.mjs` | Observability | Task state |
| `benchmark/run-harness.mjs` | Verification | Observability |
| `PHASE2.md` | Task specification | Observability |
| `PHASE3.md` | Task specification | Observability, verification |
| `PHASE4.md` | Task specification | Project memory |
| `.project-manager/README.md` | Project memory | Intervention recording |
| `docs/SELF_IMPROVE.md` | Entropy auditing | Intervention recording, intervention recording |
| `docs/proposals/.gitkeep` | Intervention recording | Entropy auditing |
| `docs/templates/harness-proposal.md` | Intervention recording | Entropy auditing, task specification |
| `scripts/h5-structural-audit.mjs` | Entropy auditing | Observability, failure attribution |
| `scripts/propose-change.mjs` | Entropy auditing | Intervention recording, failure attribution |
| `scripts/apply-proposal.sh` | Intervention recording | Permissions, entropy auditing |
| `scripts/hooks/h5-propose.mjs` | Entropy auditing | Observability, intervention recording |
| `scripts/verify-h5.sh` | Verification | Entropy auditing |
| `scripts/upgrade.sh` | Tool access | Permissions |

## Coverage Summary

- Covered: 11/11 responsibilities.
- Partial: 0/11 responsibilities.
- Missing: 0/11 responsibilities.

Covered responsibilities:

- Task specification.
- Context selection.
- Project memory.
- Task state.
- Tool access.
- Permissions.
- Verification.
- Observability.
- Failure attribution.
- Entropy auditing.
- Intervention recording.

H3 converted the previously partial responsibilities (observability, failure attribution,
entropy auditing) into measurable checks via trace scoring, friction-by-component grouping,
and benchmark attribution. H4 added automated verification hooks and batch proof validation.
H5 closes the final gap (intervention recording) with a structured proposal lifecycle:
`scripts/h5-structural-audit.mjs` (structural self-analysis), `scripts/propose-change.mjs`
(friction + audit → draft proposals), `scripts/apply-proposal.sh` (human-gated apply with
risk tiers and outcome recording), and `docs/SELF_IMPROVE.md` (protocol doc). All 11
responsibilities are now covered with explicit files, commands, or records.
