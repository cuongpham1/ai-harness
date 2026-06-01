# H5 Self-Improvement Protocol

This document defines the self-improvement loop for the `ai-harness` template repo.
Because this is a config template (no runtime project logs), structural self-analysis
replaces runtime traces as the primary data source.

## When to Run

Trigger conditions (any one sufficient):

- A Stop hook detects the structural audit is older than 1 hour.
- A human runs `node scripts/h5-structural-audit.mjs` directly.
- A new friction pattern appears in the backlog (backlog items with `proposed` or `accepted` status).
- After applying any proposal, to verify outcome and close the loop.

## Flow

```
structural-audit
      |
      v
  findings JSON (kg/runtime/structural-audit-last.json)
      |
      v
propose-change (reads audit + backlog + friction-by-component)
      |
      v
  docs/proposals/PROP-NNN-slug.md  (Status: draft)
      |
      v
  human review  <-- Required before Status -> approved
      |
      v
apply-proposal (validates Status=approved, enforces risk gate)
      |
      v
  proposal Status: applied
  docs/proposals/archive/  <-- move after outcome recorded
```

### Step 1: Structural Audit

Run the structural audit to collect current findings:

```bash
node scripts/h5-structural-audit.mjs
```

Output written to `kg/runtime/structural-audit-last.json` and stdout.

### Step 2: Propose Changes

Generate draft proposals from audit findings and friction backlog:

```bash
node scripts/propose-change.mjs
```

Draft files created in `docs/proposals/`. Review and edit each one before approving.

### Step 3: Human Review

For each draft proposal:
1. Open the file in `docs/proposals/`.
2. Review Summary, Predicted Impact, Risk Assessment, and Validation Plan.
3. If satisfied, change `**Status:**` from `draft` to `approved`.
4. High-risk proposals require explicit acknowledgement — see Risk Tiers below.

### Step 4: Apply Proposal

```bash
bash scripts/apply-proposal.sh --id PROP-NNN
# High-risk proposals require:
bash scripts/apply-proposal.sh --id PROP-NNN --approve-risk=high
```

The script validates status and risk tier, prompts for confirmation, then marks the proposal applied.

### Step 5: Record Outcome

After running the validation plan commands:
1. Open the proposal file.
2. Update the `## Outcome` section with measured results.
3. Compare with `## Predicted Impact`.
4. Move to `docs/proposals/archive/` when complete.

## Risk Tiers

| Tier | Description | Gate |
|------|-------------|------|
| low | Documentation wording, template additions, new optional scripts | Auto-suggest; human reviews draft before approval |
| medium | Hook additions, new CLI commands, new doc sections, coverage improvements | Human review required before approval; `apply-proposal.sh` proceeds after status=approved |
| high | Changes to AGENTS.md structure, ARCHITECTURE.md direction, TEST_MATRIX.md validation requirements, hook execution order | `apply-proposal.sh` requires `--approve-risk=high` flag in addition to status=approved |

### High-Risk Change Types

The following changes are classified as high-risk regardless of apparent scope:

- Modifying the structure or section headings of `AGENTS.md`.
- Changing the direction or constraints in `docs/ARCHITECTURE.md`.
- Altering validation requirements or proof columns in `docs/TEST_MATRIX.md`.
- Reordering hooks in `.claude/settings.json` Stop, PreToolUse, or PostToolUse arrays.
- Removing or renaming existing hook scripts that are wired in settings.json.
- Changing lane definitions or risk classifications in `docs/FEATURE_INTAKE.md`.

## Rollback Criteria

A completed improvement is considered failed and should be reverted if any of the following occur:

- Harness compliance drops below 85% (measured by benchmark run).
- Trace quality average drops below 2.3/3.
- Friction tag count increases by more than 20% compared to pre-change baseline.
- An agent that previously passed parity check (`scripts/check-agent-parity.mjs`) now fails.
- A verify script (`verify-h3.sh`, `verify-h4.sh`, `verify-h5.sh`) that previously passed now fails.

## Reference Commands

| Step | Command |
|------|---------|
| Structural audit | `node scripts/h5-structural-audit.mjs` |
| Generate proposals | `node scripts/propose-change.mjs` |
| List open proposals | `ls docs/proposals/*.md \| grep -v gitkeep` |
| Apply proposal | `bash scripts/apply-proposal.sh --id PROP-NNN` |
| Friction by component | `node scripts/friction-by-component.mjs` |
| Backlog open items | `scripts/bin/harness-cli query backlog --open` |
| Verify H5 | `bash scripts/verify-h5.sh` |

## Downstream Integration

This harness ships as a template. Downstream projects that adopt it will have
runtime project logs (traces, friction entries, benchmark results) that provide
richer input than structural analysis alone.

Downstream projects can contribute friction patterns back via a future command:

```bash
# Future work — not yet implemented
scripts/bin/harness-cli import-friction <path-to-exported-friction.json>
```

Until that command exists, downstream projects should manually add friction
entries to their local `harness.db` using `harness-cli backlog add` and run
`node scripts/propose-change.mjs` to generate proposals from their accumulated
friction data.
