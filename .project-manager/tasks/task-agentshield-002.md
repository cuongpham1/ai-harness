# task-agentshield-002: AgentShield Security Skill

**Status:** done
**Lane:** normal
**Priority:** medium
**Created:** 2026-06-04

## Goal
Add adversarial security scanning skill (AgentShield pattern from ECC repo) to harness.

## Acceptance Criteria
- [ ] New skill file `scripts/skills/agent-shield.md` implementing 3-agent adversarial pattern
- [ ] Attacker agent prompt covers: hook injection vectors, MCP permission matrix, secret patterns (14 types), AGENTS.md injection, tool permission escalation
- [ ] Defender agent prompt evaluates each finding for real exploitability (not theoretical)
- [ ] Auditor agent synthesizes into actionable `docs/security-audit-{date}.md` report
- [ ] Skill callable via `/agent-shield` or `harness-cli security scan`
- [ ] Wired into H5 proposal validation: proposals with risk=high auto-trigger shield scan
- [ ] Documented in README.md security section

## Context
ECC AgentShield: attacker agent finds exploit chains → defender evaluates → auditor synthesizes.
14 secret patterns: API keys, tokens, passwords, private keys, env vars, connection strings, etc.
MCP permission matrix: tool caps, server trust, injection via tool descriptions.
Hook injection: malicious content in Write/Edit triggering hook side effects.

Integration point: `scripts/apply-proposal.sh` calls shield before applying high-risk proposals.

## Notes

### After-Work — 2026-06-04
**Agent:** coder
**Outcome:** completed
**Done:** Implemented AgentShield 3-agent adversarial security skill with static analysis script, apply-proposal.sh integration, skill registry entry, and README security section.
**Files changed:** .claude/skills/agent-shield.md, scripts/security-shield.mjs, scripts/apply-proposal.sh, frameworks/_schema/skill-registry.json, README.md
**Errors:** none
**Friction:** Secret pattern scanner had false positives from pattern definition strings inside security tool source files — resolved by skipping security-shield.mjs and content-guard.mjs, and skipping lines containing regex pattern definitions (re: /.../ pattern). Also tightened exec() pattern to require child_process qualifier to avoid matching RegExp.prototype.exec() calls.
**Decisions:** Skill placed in .claude/skills/ (not scripts/skills/ as AC said — the harness install system uses .claude/skills/ as the canonical destination; scripts/skills/ does not exist). Registry entry uses framework=all since AgentShield is framework-agnostic. Static analysis tool exits with code 2 when HIGH findings present (distinct from error exit 1) so apply-proposal.sh can distinguish scan failure from security block. Agent-shield.md self-excluded from agent injection scan to prevent self-referential false positives.
**Risks/Blockers:** The `harness-cli security scan` invocation mentioned in AC is not wired — harness-cli is a prebuilt binary and its subcommands cannot be extended from this repo. The /agent-shield slash command works via .claude/skills/ as a skill reference. execSync finding in auto-checkpoint.js is a legitimate MEDIUM finding (pre-existing, not introduced by this task).

## Notes

### After-Work (fix) — 2026-06-04
**Agent:** coder
**Outcome:** completed
**Done:** Fixed --skip-shield env-var gate (requires FORCE_SKIP_SHIELD=1); fixed PROP_ID regex anchor (^PROP-[0-9]+$); fixed ReDoS in base64 pattern (maxLineLen:200 pre-filter + scanFile honors it); fixed self-exclusion to use relative paths via SKIP_RELPATHS Set; raised password pattern minimum to 16 chars; refactored scanMcp() into checkMcpServer() helper and added .mcp.json scanning.
**Files changed:** scripts/apply-proposal.sh, scripts/security-shield.mjs
**Errors:** none
**Decisions:** checkMcpServer() takes a sourceFile string parameter so findings cite the correct config file (.claude/settings.json or .mcp.json). LOW-severity parse-error finding added for malformed .mcp.json.
