# Friction Review Protocol

Turn repeated harness friction into prioritized improvements (H3 entropy auditing).

## When to run

| Trigger | Action |
|---------|--------|
| After every **normal** or **high-risk** task | Scan latest After-Work `**Friction:**` field |
| Weekly (or when friction rows > 5) | Full review via `scripts/bin/harness-cli query friction` |
| Before closing a backlog item | Compare predicted impact vs measured outcome |

## Steps

1. **Collect friction**

   ```bash
   scripts/bin/harness-cli query friction
   node scripts/friction-by-component.mjs
   ```

2. **Classify** — After-Work must start with a tag (see table below).

3. **Escalate** — If the same tag appears **≥2 times** in 7 days, open a backlog item:

   ```bash
   scripts/bin/harness-cli backlog add \
     --title "Fix hook-gap in stop handoff" \
     --pain "Agents forget After-Work on in_progress tasks" \
     --predicted "Harness compliance +10%; fewer stop loops"
   ```

4. **Close the loop** — After the fix, measure and close:

   ```bash
   bash benchmark/run-harness.sh
   node benchmark/compare.mjs benchmark/results/baseline-h3.jsonl benchmark/results/LATEST.jsonl
   scripts/bin/harness-cli backlog close --id N --outcome "compliance 82%→91%; task_state friction -2"
   ```

5. **Query closed items** for predicted vs actual:

   ```bash
   scripts/bin/harness-cli query backlog --closed
   ```

## Friction tag → component map

Maps to [HARNESS_COMPONENTS.md](HARNESS_COMPONENTS.md) Runtime Substrate responsibilities:

| Tag | Responsibility # | Name |
|-----|------------------|------|
| `docs-stale` | 2 | Context selection |
| `context-bloat` | 2 | Context selection |
| `hook-gap` | 6 | Observability |
| `proof-gap` | 8 | Verification |
| `dual-track` | 5 | Task state |
| `tool-gap` | 3 | Tool access |
| `perm-gap` | 9 | Permissions |
| `memory-gap` | 4 | Project memory |

## After-Work format

```markdown
**Friction:** hook-gap: stop-handoff loop until After-Work added
```

- First token before `:` is the tag (required for normal/high-risk).
- Use `none` for tiny lane or when no friction occurred.

## Related

- [HARNESS.md](HARNESS.md) — Growth rule and backlog outcome loop
- [HARNESS_BACKLOG.md](HARNESS_BACKLOG.md) — friction tag list
- [TRACE_SPEC.md](TRACE_SPEC.md) — trace tier requirements
