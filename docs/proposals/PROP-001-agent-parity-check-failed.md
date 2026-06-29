# Proposal: [EMERGING - unconfirmed] Agent parity check failed

<!-- finding-id: agent-parity-fail -->

**ID:** PROP-001
**Date:** 2026-06-04
**Source:** structural-audit
**Risk:** medium
**Status:** draft

## Summary

node scripts/check-agent-parity.mjs exited 1. Output: DRIFT coder.md (body hash mismatch — run: node scripts/sync-cursor-agents.mjs)
DRIFT explorer.md (body hash mismatch — run: node scripts/sync-cursor-agents.mjs)

Agent parity check FAILED (2 issue(s))


Suggested action: Run "node scripts/check-agent-parity.mjs" and fix the reported parity gaps.

## Predicted Impact

| Metric | Current | Expected Delta |
|--------|---------|----------------|
| harness_compliance_pct | ? | +?% |
| trace_quality_avg | ? | +? |
| friction_tag_count | ? | -? |

## Risk Assessment

This proposal is classified as **medium** risk.


This change adds or modifies hooks, CLI commands, or documentation structure. Requires human review before approval.


Component affected: Permissions

## Validation Plan

After applying this change, run:

```bash
node scripts/h5-structural-audit.mjs
bash scripts/verify-h5.sh
```

Verify that the finding `agent-parity-fail` no longer appears in the audit output.

## Rollback Criteria

Revert if:
- bash scripts/verify-h5.sh fails after applying the change.
- harness_compliance_pct drops below 85%.
- trace_quality_avg drops below 2.3.

## Rollback Steps

1. Revert the file changes made when applying this proposal.
2. Run `bash scripts/verify-h5.sh` to confirm harness is restored.
3. Update this proposal's Status to `reverted` and document the reason in ## Outcome.

## Outcome

[Fill after applying. Compare with Predicted Impact.]
