#!/usr/bin/env node
/**
 * propose-change.mjs — generates draft proposal files from structural audit findings
 * and friction backlog data.
 *
 * Data sources:
 *   1. kg/runtime/structural-audit-last.json (structural findings)
 *   2. harness-cli query backlog (proposed/accepted items not yet implemented)
 *   3. node scripts/friction-by-component.mjs (friction groupings)
 *
 * Creates docs/proposals/PROP-NNN-slug.md for each high/medium finding without
 * an existing proposal. Skips if a proposal with the same finding id already exists.
 *
 * Always exits 0. Errors go to stderr.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();

const auditFile = path.join(cwd, 'kg', 'runtime', 'structural-audit-last.json');
const proposalsDir = path.join(cwd, 'docs', 'proposals');
const cliPath = path.join(cwd, 'scripts', 'bin', 'harness-cli');
const today = new Date().toISOString().slice(0, 10);

function log(...args) { process.stderr.write(args.join(' ') + '\n'); }

// ── Load audit findings ───────────────────────────────────────────────────────
function loadAuditFindings() {
  if (!fs.existsSync(auditFile)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
    return (data.findings || []).filter(f => f.severity === 'high' || f.severity === 'medium');
  } catch (err) {
    log(`[propose-change] Failed to read audit file: ${err.message}`);
    return [];
  }
}

// ── Load backlog items ────────────────────────────────────────────────────────
function loadBacklogItems() {
  if (!fs.existsSync(cliPath)) return [];
  const result = spawnSync(cliPath, ['query', 'backlog'], { cwd, encoding: 'utf8', timeout: 10000 });
  const raw = result.status === 0 ? result.stdout : '';
  if (!raw) return [];
  try {
    const lines = raw.trim().split('\n')
      .filter(l => l.trim() && !l.startsWith('id') && !l.startsWith('--'));
    return lines.map(l => {
      const parts = l.split('|').map(p => p.trim());
      return { id: parts[0], status: parts[2], description: parts[3] || '' };
    }).filter(item => item.status === 'proposed' || item.status === 'accepted');
  } catch {
    return [];
  }
}

// ── Load friction data ────────────────────────────────────────────────────────
function loadFrictionData() {
  const frictionScript = path.join(cwd, 'scripts', 'friction-by-component.mjs');
  if (!fs.existsSync(frictionScript)) return null;
  try {
    const result = spawnSync('node', [frictionScript, '--json'], {
      cwd, encoding: 'utf8', timeout: 15000,
    });
    if (result.stdout) return JSON.parse(result.stdout);
    return null;
  } catch {
    return null;
  }
}

// ── Scan existing proposals ───────────────────────────────────────────────────
function getExistingProposals() {
  fs.mkdirSync(proposalsDir, { recursive: true });
  const files = fs.readdirSync(proposalsDir).filter(f => f.endsWith('.md') && f !== '.gitkeep');

  const existing = new Set();
  let maxPropNum = 0;

  for (const file of files) {
    // Extract PROP number
    const numMatch = file.match(/^PROP-(\d+)/i);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      if (n > maxPropNum) maxPropNum = n;
    }

    // Read content to collect referenced finding IDs
    try {
      const content = fs.readFileSync(path.join(proposalsDir, file), 'utf8');
      // Look for finding IDs in content (stored as HTML comment or in detail section)
      const idMatches = content.matchAll(/<!-- finding-id: ([^\s]+) -->/g);
      for (const m of idMatches) existing.add(m[1]);
      // Also check for ID in the filename slug patterns
      existing.add(file.replace(/^PROP-\d+-/, '').replace('.md', ''));
    } catch {
      // ignore
    }
  }

  return { existing, maxPropNum };
}

// ── Slugify a title ───────────────────────────────────────────────────────────
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// ── Generate a proposal file ──────────────────────────────────────────────────
function generateProposal(propNum, finding, frictionData) {
  const id = String(propNum).padStart(3, '0');
  const slug = slugify(finding.title);
  const filename = `PROP-${id}-${slug}.md`;
  const filePath = path.join(proposalsDir, filename);

  const riskMap = { high: 'high', medium: 'medium', low: 'low' };
  const risk = riskMap[finding.severity] || 'low';

  // Build friction context if available
  let frictionNote = '';
  if (frictionData && frictionData.components && frictionData.components.length > 0) {
    const topComponent = frictionData.components[0];
    frictionNote = `\nTop friction component: ${topComponent.label} (count: ${topComponent.count})`;
  }

  const content = `# Proposal: ${finding.title}

<!-- finding-id: ${finding.id} -->

**ID:** PROP-${id}
**Date:** ${today}
**Source:** structural-audit
**Risk:** ${risk}
**Status:** draft

## Summary

${finding.detail || finding.title}${frictionNote}

Suggested action: ${finding.suggested_action || 'Review and address the finding.'}

## Predicted Impact

| Metric | Current | Expected Delta |
|--------|---------|----------------|
| harness_compliance_pct | ? | +?% |
| trace_quality_avg | ? | +? |
| friction_tag_count | ? | -? |

## Risk Assessment

This proposal is classified as **${risk}** risk.

${risk === 'high' ? 'This change affects core harness structure (AGENTS.md, ARCHITECTURE.md, TEST_MATRIX.md, or hook execution order). Requires --approve-risk=high flag when applying.' : ''}
${risk === 'medium' ? 'This change adds or modifies hooks, CLI commands, or documentation structure. Requires human review before approval.' : ''}
${risk === 'low' ? 'This change is additive or documentary in nature. Low risk of regression.' : ''}

Component affected: ${finding.component}

## Validation Plan

After applying this change, run:

\`\`\`bash
node scripts/h5-structural-audit.mjs
bash scripts/verify-h5.sh
\`\`\`

Verify that the finding \`${finding.id}\` no longer appears in the audit output.

## Rollback Criteria

Revert if:
- bash scripts/verify-h5.sh fails after applying the change.
- harness_compliance_pct drops below 85%.
- trace_quality_avg drops below 2.3.

## Rollback Steps

1. Revert the file changes made when applying this proposal.
2. Run \`bash scripts/verify-h5.sh\` to confirm harness is restored.
3. Update this proposal's Status to \`reverted\` and document the reason in ## Outcome.

## Outcome

[Fill after applying. Compare with Predicted Impact.]
`;

  fs.writeFileSync(filePath, content);
  return filename;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const findings = loadAuditFindings();
  const backlogItems = loadBacklogItems();
  const frictionData = loadFrictionData();

  log(`[propose-change] audit findings (high/medium): ${findings.length}`);
  log(`[propose-change] open backlog items (proposed/accepted): ${backlogItems.length}`);

  const { existing, maxPropNum } = getExistingProposals();

  let created = 0;
  let skipped = 0;
  let currentPropNum = maxPropNum;

  for (const finding of findings) {
    if (existing.has(finding.id)) {
      log(`[propose-change] skip ${finding.id} — proposal already exists`);
      skipped++;
      continue;
    }

    currentPropNum++;
    const filename = generateProposal(currentPropNum, finding, frictionData);
    log(`[propose-change] created ${filename}`);
    created++;
  }

  // Also note backlog items that may need proposals (informational only)
  if (backlogItems.length > 0) {
    log(`[propose-change] ${backlogItems.length} open backlog item(s) with proposed/accepted status:`);
    for (const item of backlogItems.slice(0, 5)) {
      log(`  [${item.id}] ${item.description.slice(0, 60)}`);
    }
    if (backlogItems.length > 5) {
      log(`  ... and ${backlogItems.length - 5} more`);
    }
  }

  log(`[propose-change] done. created=${created} skipped=${skipped}`);

  process.exit(0);
}

main();
