# Architecture

This document describes the **AI Harness installer** architecture: how harness
components fit together and how they are installed into target projects.

Target projects (Flutter, Node, Python, etc.) add their own stack-specific
architecture doc (for example `CLAUDE.md`). This file covers the harness layer only.

## Harness Components

```text
Entry & policy
  AGENTS.md, docs/HARNESS.md, docs/FEATURE_INTAKE.md, docs/CONTEXT_RULES.md

Claude Code runtime
  .claude/agents/*          specialist agent definitions
  .claude/settings.json     hook configuration

Cursor runtime (parity)
  .cursor/hooks.json        Cursor hook wiring
  .cursor/rules/*.mdc       always-on harness policy
  .cursor/agents/*          subagents (synced from .claude/agents)
  scripts/hooks/cursor/*    Cursor hook adapters

Shared runtime
  scripts/hooks/*           session enforcement (handoff, guard, trace)
  scripts/hud/*             status line for Claude Code
  scripts/kg.js             knowledge graph session state
  kg/runtime/, kg/traces/   local session artifacts (gitignored)

Task management
  .project-manager/tasks/   active work + After-Work notes
  docs/stories/             durable story packets
  docs/templates/*          intake, story, decision, validation formats

Durable layer
  scripts/bin/harness-cli   Rust CLI (prebuilt binary)
  scripts/schema/*.sql      SQLite migrations
  harness.db                local operational records (gitignored)

Distribution
  install.sh                full AI Harness installer (agents + hooks + docs + CLI)
  scripts/install-harness.sh upstream merge installer (docs + CLI only)

Observability & maturity
  docs/TRACE_SPEC.md        trace quality tiers
  docs/FRICTION_REVIEW.md   friction-to-backlog protocol (H3)
  docs/HARNESS_COMPONENTS.md  responsibility taxonomy
  docs/HARNESS_MATURITY.md  H0–H5 maturity ladder
  benchmark/                harness benchmark + compare.mjs (H3)
  scripts/verify-h3.sh      H3 verification script
  scripts/friction-by-component.mjs  friction grouping
```

## Dependency Rule (harness code)

When extending harness tooling:

| Layer | May depend on | Must not depend on |
| --- | --- | --- |
| Policy docs (`docs/*.md`) | other policy docs | target application code |
| Hooks / HUD (Node) | `scripts/utils/*`, `kg/*` paths | Rust CLI internals |
| Rust CLI (`crates/harness-cli`) | SQLite, CLI args | Claude Code hooks |
| Installer scripts | repo file tree | target project runtime |

## Installer Boundary

`install.sh` copies harness files into a target project. It must not scaffold
application source, fake validation commands, or overwrite existing harness
files without explicit upgrade consent.

`scripts/install-harness.sh` (from [harness-experimental](https://github.com/hoangnb24/harness-experimental)) merges upstream harness docs and downloads `harness-cli`. Use `--merge` when the target already has `.claude/` and hooks.

## Durable Layer Boundary

- Policy: markdown in `docs/` (human-readable, version-controlled).
- Records: SQLite via `harness-cli` (machine-queryable, per-project instance).
- Session state: `kg/` JSON (Claude Code hooks; complements but does not replace CLI traces for maturity scoring).

## Target Project Layering (template)

When a target project implements application code, prefer:

```text
domain → application → infrastructure → interface → app surfaces
```

Record stack choices in `docs/decisions/` when they constrain future work. See
[harness-experimental ARCHITECTURE](https://github.com/hoangnb24/harness-experimental/blob/main/docs/ARCHITECTURE.md) for generic parse-first and command/query boundary rules.

## Observability Contract

Harness tasks should leave evidence at two levels:

1. **Task file After-Work** — enforced by hooks on session end.
2. **CLI trace** — scored against `docs/TRACE_SPEC.md` for normal/high-risk work.

Query friction and backlog patterns with `scripts/bin/harness-cli query friction`.
