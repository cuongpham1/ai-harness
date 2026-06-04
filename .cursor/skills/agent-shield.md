# AgentShield — Adversarial Security Scan

Run a 3-agent adversarial security scan against this harness or any installed project.

## Usage

```
/agent-shield [scope]
```

Scope options: `hooks`, `mcp`, `secrets`, `agents`, `all` (default: `all`)

Produces: `docs/security-audit-{YYYY-MM-DD}.md`

---

## Pattern: 3-agent adversarial loop

### Agent 1 — Attacker

Find vulnerabilities across four attack surfaces:

**Hook injection vectors** (`scripts/hooks/`):
- `eval(` usage in any hook script
- `execSync(` or `exec(` with user-controlled or stdin-parsed arguments
- Hook reads from stdin and passes content to shell commands without sanitisation
- Hook output written to a path that is later sourced or executed (e.g. `.bashrc`, shell scripts)

**MCP permission escalation** (`.claude/settings.json` `mcpServers`):
- MCP servers with no tool-level caps — any server that can run arbitrary shell or file write
- Suspicious `command` values: curl piped to bash, npm scripts, inline node -e, server-side code execution
- Tool descriptions containing prompt injection patterns (instructions to ignore previous context)

**Secret leakage** (all config, env, md files):
- 14 pattern types — see security-shield.mjs for canonical list
- Secrets committed to tracked files (not .gitignored)
- Secret values in AGENTS.md or skill files (prompt-visible)

**AGENTS.md / skill injection** (`.claude/agents/*.md`, `.claude/skills/*.md`):
- Instruction override attempts: "ignore previous instructions", "disregard", "you are now"
- Privilege escalation phrases: "as root", "sudo", "bypass security", "skip validation"
- Embedded base64 or URL-encoded payloads that decode to instructions
- Unrestricted tool grants with no scoping rationale

Output format (one finding per block):
```
## Finding: [TITLE]
**Surface:** hooks | mcp | secrets | agents
**Severity:** HIGH | MEDIUM | LOW
**File:** path/to/file.js:linenum
**Evidence:** exact snippet or pattern match
**Attack chain:** step-by-step how this could be exploited
```

---

### Agent 2 — Defender

Evaluate each Attacker finding for real exploitability (not theoretical risk):

For each finding:
1. Confirm the file and line exist — discard stale findings
2. Determine the actual execution path: is this code reachable in normal harness use?
3. Assess whether external/untrusted input can reach the vulnerable pattern
4. Check if existing controls (content-guard.mjs, block-dangerous-bash.js) already mitigate it
5. Rate real exploitability: CONFIRMED | LIKELY | THEORETICAL | FALSE_POSITIVE

Defender output per finding:
```
## Defender Verdict: [FINDING TITLE]
**Exploitability:** CONFIRMED | LIKELY | THEORETICAL | FALSE_POSITIVE
**Reason:** one-sentence justification
**Existing controls:** list what already protects this (or "none")
**Recommended action:** specific fix or "accept risk"
```

Discard FALSE_POSITIVE findings before passing to Auditor.

---

### Agent 3 — Auditor

Synthesise confirmed and likely findings into an actionable report.

Structure the report as `docs/security-audit-{YYYY-MM-DD}.md`:

```markdown
# Security Audit — {YYYY-MM-DD}
**Scope:** [scopes scanned]
**Tool:** AgentShield / scripts/security-shield.mjs
**Findings:** {N} total — {H} HIGH, {M} MEDIUM, {L} LOW

## Executive Summary
[2–3 sentences: what was scanned, what was found, urgency]

## Confirmed Findings

### [SEVERITY] [TITLE]
- **File:** path:line
- **Attack chain:** ...
- **Fix:** specific, actionable change

## Risk-Accepted Findings (THEORETICAL)
[List with one-line justification per item]

## Scan Coverage
| Surface | Files scanned | Patterns checked |
|---------|--------------|-----------------|
| hooks   | N            | M               |
| mcp     | N            | M               |
| secrets | N            | M               |
| agents  | N            | M               |

## Next scan
Recommended: after any proposal with risk=high is applied.
```

---

## Quick invocation (static scan only)

For a fast static-only scan without running the full 3-agent loop:

```bash
node scripts/security-shield.mjs --scope all --output file
```

This writes the same report format to `docs/security-audit-{YYYY-MM-DD}.md` using regex pattern matching only.

---

## Integration

`scripts/apply-proposal.sh` automatically invokes the shield scan (static mode) before applying `risk=high` proposals. Pass `--skip-shield` to bypass (not recommended).
