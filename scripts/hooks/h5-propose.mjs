#!/usr/bin/env node
/**
 * Stop hook — H5 self-improvement: run structural audit and generate proposals.
 * Debounced: once per 30 minutes.
 * Never blocks (exit 0 always). Errors go to stderr only.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
const runtimeDir = path.join(cwd, 'kg', 'runtime');
const stateFile = path.join(runtimeDir, 'h5-propose-last.json');
const auditFile = path.join(runtimeDir, 'structural-audit-last.json');
const auditScript = path.join(cwd, 'scripts', 'h5-structural-audit.mjs');
const proposeScript = path.join(cwd, 'scripts', 'propose-change.mjs');

const DEBOUNCE_MS = 30 * 60 * 1000;      // 30 minutes
const AUDIT_STALE_MS = 60 * 60 * 1000;   // 1 hour

function safeExit() { process.exit(0); }

// Debounce check
try {
  const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (st.at && (Date.now() - new Date(st.at).getTime()) < DEBOUNCE_MS) {
    safeExit();
  }
} catch { /* first run or corrupt state — proceed */ }

// Check if audit result is stale or missing
let needsAudit = true;
if (fs.existsSync(auditFile)) {
  try {
    const stat = fs.statSync(auditFile);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < AUDIT_STALE_MS) needsAudit = false;
  } catch { /* proceed with audit */ }
}

// Run structural audit if needed
if (needsAudit && fs.existsSync(auditScript)) {
  const auditResult = spawnSync('node', [auditScript], { cwd, encoding: 'utf8', timeout: 30000 });
  if (auditResult.error) {
    process.stderr.write(`[h5-propose] audit error: ${auditResult.error.code}\n`);
  }
}

// Read audit results
let highCount = 0;
let mediumCount = 0;
try {
  const data = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
  highCount = data.summary?.high || 0;
  mediumCount = data.summary?.medium || 0;
} catch { /* no audit data, skip proposals */ }

const significantFindings = highCount + mediumCount;

// Run propose-change if there are findings
let proposalsCreated = 0;
if (significantFindings > 0 && fs.existsSync(proposeScript)) {
  try {
    const result = spawnSync('node', [proposeScript], {
      cwd, encoding: 'utf8', timeout: 30000,
    });
    const stderr = result.stderr || '';
    const createdMatch = stderr.match(/created=(\d+)/);
    if (createdMatch) proposalsCreated = parseInt(createdMatch[1], 10);
  } catch (err) {
    process.stderr.write(`[h5-propose] propose error: ${err.message}\n`);
  }
}

// Count all draft proposals
let draftProposals = 0;
try {
  const proposalsDir = path.join(cwd, 'docs', 'proposals');
  if (fs.existsSync(proposalsDir)) {
    const files = fs.readdirSync(proposalsDir).filter(f => f.endsWith('.md') && f !== '.gitkeep');
    for (const file of files) {
      const content = fs.readFileSync(path.join(proposalsDir, file), 'utf8');
      if (/\*\*Status:\*\*\s*draft/i.test(content)) draftProposals++;
    }
  }
} catch { /* ignore */ }

// Write debounce state
try {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({
    at: new Date().toISOString(),
    findings: significantFindings,
    proposals_created: proposalsCreated,
    draft_proposals: draftProposals,
  }, null, 2));
} catch { /* ignore */ }

// Output summary to stderr for additionalContext
if (significantFindings > 0 || draftProposals > 0) {
  process.stderr.write(
    `[h5-propose] H5: ${significantFindings} structural findings (${highCount} high, ${mediumCount} medium)` +
    (proposalsCreated > 0 ? `, ${proposalsCreated} new proposals created` : '') +
    (draftProposals > 0 ? `, ${draftProposals} proposal(s) pending review in docs/proposals/` : '') +
    '\n'
  );
}

process.exit(0);
