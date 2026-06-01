# Agent Instructions

**AI Harness installer repository** — source template for `bash install.sh /path/to/project`.

Target projects receive merged `AGENTS.md` from `templates/AGENTS.starter.md` + harness block. Do not copy this file verbatim to targets.

<!-- HARNESS:BEGIN -->
## Harness (installer repo)

| Doc | Purpose |
|-----|---------|
| [docs/HARNESS.md](docs/HARNESS.md) | Hybrid model, unified trace sync |
| [docs/FEATURE_INTAKE.md](docs/FEATURE_INTAKE.md) | Risk lanes |
| [frameworks/](frameworks/) | 12 stack profiles |
| [install.sh](install.sh) | Target project installer |

```bash
bash install.sh --yes --framework nodejs --name "My API" /path/to/project
scripts/bin/harness-cli query stats
bash scripts/verify-story.sh          # H4 lane-aware proof
bash scripts/verify-h4.sh             # H3 + parity + H4 dry-run
```

**Done checklist:** tiny → After-Work only; normal → full pipeline + `verify-story` on completed; high-risk → + ADR. See [docs/HARNESS_VERIFICATION.md](docs/HARNESS_VERIFICATION.md).
<!-- HARNESS:END -->

## Agent roster

See `.claude/agents/` — generic agents; stack rules come from `frameworks/<id>/` at install time.
