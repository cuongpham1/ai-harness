# Agent Instructions

Flutter add-to-app module (VNDirect superapp). Read this file first in **Cursor**, **Codex**, or any coding agent.

## Harness (read before work)

| Doc | Purpose |
|-----|---------|
| [CLAUDE.md](CLAUDE.md) | Architecture, commands, native bridge, app variants |
| [docs/HARNESS.md](docs/HARNESS.md) | How humans and agents collaborate in this repo |
| [docs/CONTEXT_RULES.md](docs/CONTEXT_RULES.md) | What to read at each phase per lane (token budget rules) |
| [docs/HARNESS_BACKLOG.md](docs/HARNESS_BACKLOG.md) | Accumulated friction and harness improvement backlog |
| [docs/FEATURE_INTAKE.md](docs/FEATURE_INTAKE.md) | Classify work: tiny / normal / high-risk |
| [docs/TEST_MATRIX.md](docs/TEST_MATRIX.md) | Behavior → required proof (unit / integration / AI UAT) |
| [.project-manager/README.md](.project-manager/README.md) | Tasks, pipeline, backlog |

## Quick commands

```bash
flutter pub get && flutter analyze && flutter test
bash scripts/run_integration_test.sh          # IPO integration E2E (device required)
bash scripts/ai_test/run_uat_ios.sh           # AI exploratory UAT (Claude + mobile-mcp)
```

## Implementation pipeline (code changes)

Do **not** skip review steps when using Claude Code agents:

```
@coder → @spec-reviewer → @reviewer → @tester → PM marks done
```

Details: `.claude/agents/pm.md`, `.project-manager/README.md`

## Task files

New or updated work lives in `.project-manager/tasks/`. Use [docs/templates/task.md](docs/templates/task.md) for the header (Lane, Risk, Validation).

## Secrets

Never commit JWT or credentials. UAT tokens: `lib/config/standalone_secrets.dart` (gitignored pattern — use `standalone_secrets.example.dart` as template).
