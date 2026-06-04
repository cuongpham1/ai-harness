#!/usr/bin/env node
/**
 * security-shield.mjs — AgentShield static security analysis.
 *
 * Scans harness files for hook injection vectors, MCP misconfigurations,
 * secrets, and AGENTS.md injection patterns. Static analysis only —
 * no subagents spawned.
 *
 * Usage:
 *   node scripts/security-shield.mjs [--scope hooks|mcp|secrets|agents|all] [--output console|file]
 *
 * Output: docs/security-audit-{YYYY-MM-DD}.md (default) or console
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag, def) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  const prefixed = args.find(a => a.startsWith(flag + '='));
  if (prefixed) return prefixed.split('=').slice(1).join('=');
  return def;
}

const scopeArg = getArg('--scope', 'all');
const outputArg = getArg('--output', 'file');

const VALID_SCOPES = ['hooks', 'mcp', 'secrets', 'agents', 'all'];
if (!VALID_SCOPES.includes(scopeArg)) {
  process.stderr.write(`[security-shield] Unknown scope: "${scopeArg}". Valid: ${VALID_SCOPES.join(', ')}\n`);
  process.exit(1);
}

const SCOPES = scopeArg === 'all'
  ? ['hooks', 'mcp', 'secrets', 'agents']
  : scopeArg.split(',').map(s => s.trim());

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// ---------------------------------------------------------------------------
// Secret patterns (14 types)
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  { label: 'API key (generic)',        re: /(?:api_key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}/i },
  { label: 'Secret/token/password',   re: /(?:secret|token|password|passwd|pwd)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}/i },
  { label: 'OpenAI / Anthropic key',  re: /sk-[a-zA-Z0-9]{32,}/ },
  { label: 'Bearer token',            re: /bearer\s+[a-zA-Z0-9._\-]{20,}/i },
  { label: 'ANTHROPIC_API_KEY',       re: /ANTHROPIC_API_KEY\s*=\s*[^\s]/ },
  { label: 'OPENAI_API_KEY',          re: /OPENAI_API_KEY\s*=\s*[^\s]/ },
  { label: 'AWS access key ID',       re: /AKIA[0-9A-Z]{16}/ },
  { label: 'AWS secret access key',   re: /aws_secret_access_key\s*=\s*[a-zA-Z0-9/+]{40}/i },
  { label: 'Private key header',      re: /-----BEGIN (?:RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/ },
  { label: 'GitHub token',            re: /gh[ps]_[a-zA-Z0-9]{36}/ },
  { label: 'JWT token',               re: /eyJ[a-zA-Z0-9_\-]{10,}\.eyJ[a-zA-Z0-9_\-]{10,}/ },
  { label: 'Connection string',       re: /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@/ },
  { label: 'Generic password in URL', re: /:\/\/[^:]+:[^@]{6,}@/ },
  { label: 'Slack token',             re: /xox[baprs]-[0-9a-zA-Z\-]{10,}/ },
];

// ---------------------------------------------------------------------------
// Hook injection patterns
// ---------------------------------------------------------------------------

const HOOK_PATTERNS = [
  { label: 'eval() usage',                        re: /\beval\s*\(/ },
  { label: 'execSync with possible user input',   re: /execSync\s*\(/ },
  { label: 'exec() with user-controlled data',     re: /(?:child_process\.exec|require\(['"]child_process['"]\).*\.exec)\s*\(/ },
  { label: 'Stdin piped to shell without check',  re: /stdin.*shell|shell.*stdin/i },
  { label: 'Write to shell-executable path',      re: /writeFileSync\s*\([^,]*(?:\.sh|\.bash|\.zsh|\.profile|bashrc|zshrc)/ },
  { label: 'spawnSync with shell:true',           re: /spawnSync\s*\([^)]*shell\s*:\s*true/ },
  { label: 'child_process with template literal', re: /exec(?:Sync)?\s*\(`[^`]*\$\{/ },
];

// ---------------------------------------------------------------------------
// MCP patterns
// ---------------------------------------------------------------------------

const MCP_SUSPICIOUS_CMDS = [
  { label: 'curl piped to shell',      re: /curl[^|]*\|\s*(?:bash|sh|zsh)/ },
  { label: 'Inline node -e execution', re: /node\s+-e\s+/ },
  { label: 'npm run arbitrary script', re: /npm\s+run\s+/ },
  { label: 'Shell eval in command',    re: /\beval\b/ },
  { label: 'Python -c execution',      re: /python[23]?\s+-c\s+/ },
];

const MCP_DESC_INJECTION = [
  { label: 'Prompt injection in tool description', re: /ignore (?:previous|all|above)|disregard|you are now|new instructions/i },
  { label: 'Privilege escalation in description',  re: /as root|sudo |bypass security|skip validation/i },
];

// ---------------------------------------------------------------------------
// Agent/skill injection patterns
// ---------------------------------------------------------------------------

const AGENT_INJECTION_PATTERNS = [
  { label: 'Instruction override attempt',  re: /ignore (?:previous|all|above) instructions|disregard your|you are now|forget (?:all|your)/i },
  { label: 'Privilege escalation phrase',   re: /\bsudo\b|as root|bypass (?:security|auth|check|validation)|skip (?:security|validation|review)/i },
  { label: 'Base64-encoded payload',        re: /(?:^|\s)([A-Za-z0-9+/]{40,}={0,2})(?:\s|$)/, maxLineLen: 200 },
  { label: 'Embedded URL-encoded payload',  re: /%[0-9a-fA-F]{2}(?:%[0-9a-fA-F]{2}){10,}/ },
  { label: 'Tool grant without scope',      re: /^tools?:\s*\*|allow\s+all\s+tools/i },
];

// ---------------------------------------------------------------------------
// Utility: walk files recursively
// ---------------------------------------------------------------------------

function walkFiles(dir, ext = [], skipDirs = ['.git', 'node_modules', 'bin']) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (skipDirs.includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        if (ext.length === 0 || ext.some(e => entry.name.endsWith(e))) {
          results.push(full);
        }
      }
    }
  }

  walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// Utility: scan file lines against patterns
// ---------------------------------------------------------------------------

function scanFile(filePath, patterns) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch { return []; }

  const lines = content.split('\n');
  const findings = [];

  for (const { label, re, maxLineLen } of patterns) {
    for (let i = 0; i < lines.length; i++) {
      if (maxLineLen && lines[i].length > maxLineLen) continue;
      const match = re.exec(lines[i]);
      if (match) {
        findings.push({
          label,
          file: filePath,
          line: i + 1,
          snippet: lines[i].trim().slice(0, 120),
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Scope: hooks
// ---------------------------------------------------------------------------

function scanHooks() {
  const hooksDir = path.join(ROOT, 'scripts', 'hooks');
  const files = walkFiles(hooksDir, ['.js', '.mjs', '.sh', '.ts']);
  const findings = [];

  for (const f of files) {
    const hits = scanFile(f, HOOK_PATTERNS);
    for (const h of hits) {
      findings.push({
        surface: 'hooks',
        severity: h.label.includes('eval') || h.label.includes('template') ? 'HIGH' : 'MEDIUM',
        title: h.label,
        file: path.relative(ROOT, h.file) + ':' + h.line,
        evidence: h.snippet,
        attackChain: buildHookAttackChain(h.label),
      });
    }
  }

  return findings;
}

function buildHookAttackChain(label) {
  if (label.includes('eval')) return 'Attacker controls hook input → eval() executes arbitrary code in Node.js context → full process access';
  if (label.includes('execSync')) return 'If execSync receives unvalidated stdin content → shell injection → arbitrary command execution on host';
  if (label.includes('template')) return 'Template literal in exec() call → if any interpolated variable is user-controlled → command injection';
  if (label.includes('shell-executable path')) return 'Hook writes to .sh/.profile → next shell source loads attacker content → persistent code execution';
  return 'User-controlled data flows into shell execution context → potential injection';
}

// ---------------------------------------------------------------------------
// Scope: MCP
// ---------------------------------------------------------------------------

function checkMcpServer(name, srv, sourceFile) {
  const findings = [];

  // Check command field
  const cmd = typeof srv.command === 'string' ? srv.command : JSON.stringify(srv.command || '');
  const fullCmd = [cmd, ...(srv.args || [])].join(' ');

  for (const { label, re } of MCP_SUSPICIOUS_CMDS) {
    if (re.test(fullCmd)) {
      findings.push({
        surface: 'mcp',
        severity: 'HIGH',
        title: `MCP server '${name}': ${label}`,
        file: `${sourceFile} (mcpServers.${name})`,
        evidence: 'command: ' + fullCmd.slice(0, 100),
        attackChain: 'Compromised MCP server executes arbitrary shell → escalates to host OS access',
      });
    }
  }

  // Check tool descriptions for injection
  const tools = srv.tools || [];
  for (const tool of tools) {
    const desc = (tool.description || '') + ' ' + (tool.name || '');
    for (const { label, re } of MCP_DESC_INJECTION) {
      if (re.test(desc)) {
        findings.push({
          surface: 'mcp',
          severity: 'HIGH',
          title: `MCP tool '${tool.name}' in '${name}': ${label}`,
          file: sourceFile,
          evidence: desc.slice(0, 120),
          attackChain: 'Tool description overrides agent instructions → agent follows attacker commands instead of user intent',
        });
      }
    }
  }

  // Check for uncapped access (no tool restrictions)
  if (!srv.tools && !srv.allowedTools && !srv.permissions) {
    findings.push({
      surface: 'mcp',
      severity: 'MEDIUM',
      title: `MCP server '${name}': no tool-level access cap`,
      file: `${sourceFile} (mcpServers.${name})`,
      evidence: 'No tools[], allowedTools, or permissions field found',
      attackChain: 'Server has unrestricted tool access → any tool call goes through without allow-list check',
    });
  }

  return findings;
}

function scanMcp() {
  const findings = [];

  // Scan .claude/settings.json
  const settingsPath = path.join(ROOT, '.claude', 'settings.json');
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(raw);
    const servers = settings.mcpServers || {};
    for (const [name, srv] of Object.entries(servers)) {
      findings.push(...checkMcpServer(name, srv, '.claude/settings.json'));
    }
  } catch {
    // settings.json missing or unparseable — not an error
  }

  // Scan .mcp.json at repo root
  const mcpJsonPath = path.join(ROOT, '.mcp.json');
  if (fs.existsSync(mcpJsonPath)) {
    try {
      const mcpRaw = fs.readFileSync(mcpJsonPath, 'utf8');
      const mcpConf = JSON.parse(mcpRaw);
      const mcpServers = mcpConf.mcpServers || {};
      for (const [name, srv] of Object.entries(mcpServers)) {
        findings.push(...checkMcpServer(name, srv, '.mcp.json'));
      }
    } catch (e) {
      findings.push({ severity: 'LOW', label: 'MCP parse error', detail: `.mcp.json: ${e.message}`,
        surface: 'mcp', title: 'MCP parse error', file: '.mcp.json',
        evidence: e.message, attackChain: 'Malformed .mcp.json may hide misconfigured servers' });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Scope: secrets
// ---------------------------------------------------------------------------

function scanSecrets() {
  const SKIP_DIRS = ['.git', 'node_modules', 'bin', 'dist', 'build', '.harness-profile'];
  const SCAN_EXTS = ['.json', '.js', '.mjs', '.ts', '.sh', '.env', '.md', '.yaml', '.yml', '.toml', '.ini', '.conf'];

  const files = walkFiles(ROOT, SCAN_EXTS, [...SKIP_DIRS, 'node_modules']);
  const findings = [];

  // Skip files that are security tool source (they contain pattern strings, not real secrets)
  const SKIP_NAMES = ['harness.db', 'harness-cli'];
  const SKIP_RELPATHS = new Set(['scripts/security-shield.mjs', 'scripts/content-guard.mjs']);

  for (const f of files) {
    const base = path.basename(f);
    if (SKIP_NAMES.includes(base)) continue;
    if (SKIP_RELPATHS.has(path.relative(ROOT, f))) continue;

    const hits = scanFile(f, SECRET_PATTERNS);
    for (const h of hits) {
      // Skip placeholder/example values
      const snippet = h.snippet.toLowerCase();
      if (/your[_\-]?(?:key|secret|token|api)|placeholder|example|changeme|xxx|<.*?>/.test(snippet)) continue;
      // Skip comment lines
      if (/^\s*[#\/\*]/.test(h.snippet)) continue;
      // Skip lines that look like regex pattern definitions (re: /.../, label: '...')
      if (/re:\s*\//.test(h.snippet)) continue;

      findings.push({
        surface: 'secrets',
        severity: 'HIGH',
        title: `Potential secret: ${h.label}`,
        file: path.relative(ROOT, h.file) + ':' + h.line,
        evidence: h.snippet,
        attackChain: 'Secret committed to tracked file → accessible to anyone with repo read access → credential compromise',
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Scope: agents
// ---------------------------------------------------------------------------

function scanAgents() {
  const agentsDir = path.join(ROOT, '.claude', 'agents');
  const skillsDir = path.join(ROOT, '.claude', 'skills');
  const findings = [];

  // Files that intentionally describe security patterns (skip to avoid self-referential FP)
  const SECURITY_SKILL_FILES = ['agent-shield.md'];

  const dirs = [agentsDir, skillsDir];
  for (const dir of dirs) {
    const files = walkFiles(dir, ['.md']);
    for (const f of files) {
      if (SECURITY_SKILL_FILES.includes(path.basename(f))) continue;
      const hits = scanFile(f, AGENT_INJECTION_PATTERNS);
      for (const h of hits) {
        findings.push({
          surface: 'agents',
          severity: h.label.includes('override') || h.label.includes('escalation') ? 'HIGH' : 'MEDIUM',
          title: `Agent file: ${h.label}`,
          file: path.relative(ROOT, h.file) + ':' + h.line,
          evidence: h.snippet,
          attackChain: buildAgentAttackChain(h.label),
        });
      }
    }
  }

  return findings;
}

function buildAgentAttackChain(label) {
  if (label.includes('override')) return 'Injected instruction overrides agent system prompt → agent follows attacker directives → data exfiltration or harmful actions';
  if (label.includes('escalation')) return 'Privilege escalation phrase in agent file → agent attempts to run privileged commands → host compromise';
  if (label.includes('Base64')) return 'Base64 payload decoded at runtime → hidden instructions executed → bypasses content-guard checks';
  if (label.includes('Tool grant')) return 'Wildcard tool grant → agent gains unrestricted tool access → no sandboxing boundary';
  return 'Suspicious pattern in agent definition → may alter agent behavior in unintended ways';
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function severityOrder(s) {
  return s === 'HIGH' ? 0 : s === 'MEDIUM' ? 1 : 2;
}

function buildReport(allFindings, scopes, date) {
  const sorted = [...allFindings].sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));

  const high = sorted.filter(f => f.severity === 'HIGH');
  const med  = sorted.filter(f => f.severity === 'MEDIUM');
  const low  = sorted.filter(f => f.severity === 'LOW');

  // Coverage stats
  const coverage = {};
  for (const scope of scopes) {
    const dir = scope === 'hooks' ? path.join(ROOT, 'scripts', 'hooks')
              : scope === 'agents' ? path.join(ROOT, '.claude', 'agents')
              : scope === 'mcp'    ? path.join(ROOT, '.claude')
              : ROOT;
    const ext = scope === 'hooks' ? ['.js', '.mjs', '.sh']
              : scope === 'agents' ? ['.md']
              : scope === 'secrets' ? ['.json', '.js', '.mjs', '.ts', '.sh', '.env', '.md', '.yaml', '.yml']
              : ['.json'];
    const files = scope === 'mcp' ? (fs.existsSync(path.join(ROOT, '.claude', 'settings.json')) ? 1 : 0) + (fs.existsSync(path.join(ROOT, '.mcp.json')) ? 1 : 0)
                : walkFiles(dir, ext).length;
    const patterns = scope === 'hooks' ? HOOK_PATTERNS.length
                   : scope === 'mcp'    ? MCP_SUSPICIOUS_CMDS.length + MCP_DESC_INJECTION.length
                   : scope === 'secrets' ? SECRET_PATTERNS.length
                   : AGENT_INJECTION_PATTERNS.length;
    coverage[scope] = { files, patterns };
  }

  let md = `# Security Audit — ${date}
**Scope:** ${scopes.join(', ')}
**Tool:** AgentShield / scripts/security-shield.mjs
**Findings:** ${sorted.length} total — ${high.length} HIGH, ${med.length} MEDIUM, ${low.length} LOW

## Executive Summary

`;

  if (sorted.length === 0) {
    md += 'No security issues found across scanned surfaces. Continue running on each high-risk proposal.\n\n';
  } else {
    md += `Scanned ${scopes.join(', ')} surfaces. Found ${sorted.length} issue(s): ${high.length} HIGH severity requiring immediate action`;
    if (med.length > 0) md += `, ${med.length} MEDIUM severity for near-term remediation`;
    md += `. Review and address HIGH findings before applying any risk=high proposals.\n\n`;
  }

  if (sorted.length > 0) {
    md += '## Findings\n\n';
    for (const f of sorted) {
      md += `### [${f.severity}] ${f.title}\n`;
      md += `- **Surface:** ${f.surface}\n`;
      md += `- **File:** \`${f.file}\`\n`;
      md += `- **Evidence:** \`${f.evidence}\`\n`;
      md += `- **Attack chain:** ${f.attackChain}\n`;
      md += `- **Recommended fix:** ${suggestFix(f)}\n\n`;
    }
  } else {
    md += '## Findings\n\nNone.\n\n';
  }

  md += '## Scan Coverage\n\n';
  md += '| Surface | Files scanned | Patterns checked |\n';
  md += '|---------|--------------|------------------|\n';
  for (const scope of scopes) {
    const c = coverage[scope] || { files: 0, patterns: 0 };
    md += `| ${scope.padEnd(7)} | ${String(c.files).padEnd(12)} | ${c.patterns} |\n`;
  }

  md += `\n## Next scan\n\nRecommended: after any proposal with risk=high is applied.\n`;
  md += `\nRun: \`node scripts/security-shield.mjs --scope all --output file\`\n`;

  return { report: md, high, med, low, sorted };
}

function suggestFix(f) {
  if (f.surface === 'hooks' && f.title.includes('eval')) return 'Remove eval(); use explicit JSON.parse() or structured data parsing instead';
  if (f.surface === 'hooks' && f.title.includes('execSync')) return 'Validate and sanitise all inputs before passing to execSync; use allowlist for permitted values';
  if (f.surface === 'hooks' && f.title.includes('shell-executable')) return 'Write output to a non-executable path; never write to .sh or shell profile files from hook output';
  if (f.surface === 'mcp' && f.title.includes('curl')) return 'Remove curl|bash pattern; use a dedicated install script with checksum verification';
  if (f.surface === 'mcp' && f.title.includes('no tool-level')) return 'Add allowedTools array to restrict which tools this MCP server can invoke';
  if (f.surface === 'mcp' && f.title.includes('injection')) return 'Audit tool description; remove any instruction-like text; use neutral, factual descriptions';
  if (f.surface === 'secrets') return 'Remove secret from tracked file; rotate the credential immediately; add path to .gitignore';
  if (f.surface === 'agents' && f.title.includes('override')) return 'Remove or rewrite instruction; ensure agent files contain only legitimate role instructions';
  if (f.surface === 'agents' && f.title.includes('Base64')) return 'Decode and audit the base64 string; remove if it encodes instructions';
  return 'Review the finding and apply principle of least privilege';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const allFindings = [];

  for (const scope of SCOPES) {
    switch (scope) {
      case 'hooks':   allFindings.push(...scanHooks());   break;
      case 'mcp':     allFindings.push(...scanMcp());     break;
      case 'secrets': allFindings.push(...scanSecrets()); break;
      case 'agents':  allFindings.push(...scanAgents());  break;
      default:
        process.stderr.write(`[security-shield] Unknown scope: ${scope}\n`);
    }
  }

  const { report, high, sorted } = buildReport(allFindings, SCOPES, date);

  if (outputArg === 'console') {
    process.stdout.write(report);
  } else {
    const docsDir = path.join(ROOT, 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    const outPath = path.join(docsDir, `security-audit-${date}.md`);
    fs.writeFileSync(outPath, report, 'utf8');
    process.stderr.write(`[security-shield] Report written to: ${path.relative(ROOT, outPath)}\n`);
    process.stderr.write(`[security-shield] ${sorted.length} finding(s): ${high.length} HIGH\n`);
  }

  // Exit code: 2 = HIGH findings present (used by apply-proposal.sh)
  if (high.length > 0) {
    process.exit(2);
  }

  process.exit(0);
}

main().catch(err => {
  process.stderr.write(`[security-shield] Fatal: ${err.message}\n`);
  process.exit(1);
});
