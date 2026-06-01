# Proposal: [title]

**ID:** PROP-NNN
**Date:** YYYY-MM-DD
**Source:** structural-audit | friction-pattern | manual
**Risk:** low | medium | high
**Status:** draft | approved | applied | reverted

## Summary

[1-2 sentences describing the change and why it is needed.]

## Predicted Impact

| Metric | Current | Expected Delta |
|--------|---------|----------------|
| harness_compliance_pct | ? | +?% |
| trace_quality_avg | ? | +? |
| friction_tag_count | ? | -? |

## Risk Assessment

[Why this risk tier. What could break. Which files or behaviors are affected.]

## Validation Plan

[How to verify the change worked. List specific commands to run after applying.]

```bash
# Example validation commands
bash scripts/verify-h5.sh
node scripts/h5-structural-audit.mjs
```

## Rollback Criteria

[Specific thresholds that trigger revert. Reference the rollback criteria in docs/SELF_IMPROVE.md
or list change-specific thresholds.]

## Rollback Steps

[Exact steps to undo this change if rollback criteria are met.]

1. [Step 1]
2. [Step 2]

## Outcome

[Fill after applying. Compare measured results with Predicted Impact table above.
Record date applied, validation commands run, and actual metric deltas.]
