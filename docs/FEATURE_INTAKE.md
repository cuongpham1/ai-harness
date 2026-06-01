# Feature Intake

Every implementation prompt passes this gate **before** code changes. The agent classifies work and records it in the task file header.

## Flow

```text
User prompt
  → Classify input type
  → Restate as .project-manager task
  → Risk checklist
  → Lane: tiny | normal | high-risk
  → Record: scripts/bin/harness-cli intake (normal/high-risk)
  → Link validation expectations (TEST_MATRIX or harness-cli query matrix)
```

## Input types

| Type | Use when | Artifact |
|------|----------|----------|
| Change request | Bug fix or bounded behavior change | Task file |
| New feature | New user-visible or API behavior | Task + optional story packet |
| Maintenance | Refactor, deps, infra, performance | Task or tiny patch |
| Harness improvement | Agents, docs, hooks, templates | `docs/*`, `.claude/*`, backlog item |
| New spec | First buildout from user specification | Product docs + story candidates |

## Lanes

### Tiny

Docs-only, copy, typos, narrow edits, dependency pin with no behavior change.

**Requirements:** Patch directly; run stack quick check if code touched; no full pipeline unless user asks.

**Pipeline:** `@coder` only (optional `@tester` if code touched). No spec-reviewer/reviewer unless user requests.

### Normal

Story-sized work with bounded blast radius (one module, one API surface, one screen).

**Requirements:**

- Task file from [templates/task.md](templates/task.md)
- Scope files listed
- Tests for new logic per stack doc (`docs/*_STACK.md`)
- Full pipeline: coder → spec-reviewer → reviewer → tester
- `harness-cli intake` + structured After-Work (syncs to trace)

**Pipeline:** `@coder` → `@spec-reviewer` → `@reviewer` → `@tester`

### High-risk

Security, auth, data loss, public contracts, payments, or multi-domain changes.

**Requirements:**

- Everything in **normal**, plus:
- Story folder from [templates/high-risk-story/](templates/high-risk-story/) when scope is large
- Human confirmation before merge if direction is ambiguous
- Decision in `docs/decisions/`
- Detailed After-Work + `harness-cli score-trace` evidence

**Pipeline:** normal pipeline + `@solution-architect` before implementation when architecture unclear

## Pipeline summary

| Lane | Subagents |
|------|-----------|
| tiny | coder (optional tester) |
| normal | coder → spec-reviewer → reviewer → tester |
| high-risk | + solution-architect; MCP + RTK per [TOKEN_EFFICIENCY.md](TOKEN_EFFICIENCY.md) |

## Risk checklist

| Flag | Applies when |
|------|----------------|
| **Auth** | Login, sessions, tokens, passwords |
| **Authorization** | Roles, permissions, tenant scope |
| **Data model** | Schema, migrations, deletion, retention |
| **Audit/security** | PII, audit logs, encryption |
| **External systems** | Payments, email, webhooks, third-party APIs |
| **Public contract** | API shape, client-visible behavior |
| **Cross-platform** | Mobile + web + native shell differences |
| **Weak proof** | No test row for changed behavior |
| **Multi-domain** | More than one product area touched |

## Classification

```text
0–1 flags     → tiny or normal (by code impact)
2–3 flags     → normal with stronger validation
4+ flags      → high-risk
Any hard gate → high-risk
```

**Hard gates:** auth, authorization, data loss/migration, audit/security, external provider behavior, removing validation requirements.

## Intake output

```text
Lane: normal
Reason: touches API contract and authorization.
Task: .project-manager/tasks/task-042.md
Story: US-014 (optional)
Validation: unit + integration per docs/TEST_MATRIX.md
CLI: scripts/bin/harness-cli intake --type change_request --summary "..." --lane normal
```
