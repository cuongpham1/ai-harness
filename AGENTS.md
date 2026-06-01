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
```
<!-- HARNESS:END -->

## Agent roster

See `.claude/agents/` — generic agents; stack rules come from `frameworks/<id>/` at install time.
