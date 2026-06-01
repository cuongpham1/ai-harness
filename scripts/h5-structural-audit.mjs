#!/usr/bin/env node
/**
 * H5 structural audit — analyzes harness repo structure without runtime logs.
 * Writes findings JSON to stdout and kg/runtime/structural-audit-last.json.
 * Always exits 0 (never throws to caller).
 */
import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
const runtimeDir = path.join(cwd, 'kg', 'runtime');
const outputFile = path.join(runtimeDir, 'structural-audit-last.json');

const findings = [];

function addFinding(id, component, severity, title, detail, suggestedAction) {
  findings.push({ id, component, severity, title, detail, suggested_action: suggestedAction });
}

// ── 1. Hook coverage ─────────────────────────────────────────────────────────
function checkHookCoverage() {
  try {
    const settingsPath = path.join(cwd, '.claude', 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      addFinding(
        'hook-settings-missing',
        'Tool access',
        'high',
        'settings.json not found',
        '.claude/settings.json does not exist; hooks cannot be verified.',
        'Create .claude/settings.json with hooks configuration.'
      );
      return;
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const hooksDir = path.join(cwd, 'scripts', 'hooks');

    if (!fs.existsSync(hooksDir)) return;

    // Collect all wired commands from all hook arrays
    const wiredCommands = new Set();
    const hookSections = settings.hooks || {};
    for (const sectionHooks of Object.values(hookSections)) {
      for (const entry of sectionHooks) {
        for (const h of entry.hooks || []) {
          if (h.command) wiredCommands.add(h.command);
        }
      }
    }

    // Check each .mjs file in scripts/hooks/
    const hookFiles = fs.readdirSync(hooksDir)
      .filter(f => f.endsWith('.mjs') || f.endsWith('.js'))
      .filter(f => !f.startsWith('lib-')); // lib files are not wired directly

    for (const file of hookFiles) {
      const relPath = `scripts/hooks/${file}`;
      const isWired = [...wiredCommands].some(cmd => cmd.includes(relPath) || cmd.includes(file));
      if (!isWired) {
        addFinding(
          `hook-unwired-${file.replace(/\.(mjs|js)$/, '')}`,
          'Tool access',
          'low',
          `Hook script not wired: ${file}`,
          `${relPath} exists in scripts/hooks/ but is not referenced in .claude/settings.json hooks.`,
          `Add "${relPath}" to the appropriate hook section in .claude/settings.json, or remove the file if it is no longer needed.`
        );
      }
    }
  } catch (err) {
    addFinding(
      'hook-coverage-error',
      'Tool access',
      'low',
      'Hook coverage check failed',
      String(err.message),
      'Investigate hook coverage check error manually.'
    );
  }
}

// ── 2. Doc freshness ──────────────────────────────────────────────────────────
function checkDocFreshness() {
  const requiredDocs = [
    'docs/HARNESS_COMPONENTS.md',
    'docs/HARNESS_MATURITY.md',
    'docs/FRICTION_REVIEW.md',
  ];

  for (const doc of requiredDocs) {
    const fullPath = path.join(cwd, doc);
    if (!fs.existsSync(fullPath)) {
      addFinding(
        `doc-missing-${path.basename(doc, '.md').toLowerCase()}`,
        'Observability',
        'medium',
        `Required doc missing: ${doc}`,
        `${doc} does not exist. This file is required for harness observability and friction attribution.`,
        `Create ${doc} following the existing pattern in docs/.`
      );
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8').trim();
    if (content.length < 100) {
      addFinding(
        `doc-empty-${path.basename(doc, '.md').toLowerCase()}`,
        'Observability',
        'medium',
        `Required doc appears empty or minimal: ${doc}`,
        `${doc} exists but contains fewer than 100 characters.`,
        `Populate ${doc} with the required content.`
      );
    }
  }
}

// ── 3. Agent parity ───────────────────────────────────────────────────────────
function checkAgentParity() {
  const parityScript = path.join(cwd, 'scripts', 'check-agent-parity.mjs');
  if (!fs.existsSync(parityScript)) {
    addFinding(
      'agent-parity-script-missing',
      'Permissions',
      'medium',
      'check-agent-parity.mjs not found',
      'scripts/check-agent-parity.mjs does not exist.',
      'Create the agent parity check script.'
    );
    return;
  }

  try {
    const result = spawnSync('node', [parityScript], {
      cwd,
      encoding: 'utf8',
      timeout: 15000,
    });

    if (result.status !== 0) {
      const output = (result.stdout || '') + (result.stderr || '');
      addFinding(
        'agent-parity-fail',
        'Permissions',
        'medium',
        'Agent parity check failed',
        `node scripts/check-agent-parity.mjs exited ${result.status}. Output: ${output.slice(0, 300)}`,
        'Run "node scripts/check-agent-parity.mjs" and fix the reported parity gaps.'
      );
    }
  } catch (err) {
    addFinding(
      'agent-parity-error',
      'Permissions',
      'low',
      'Agent parity check errored',
      String(err.message),
      'Investigate check-agent-parity.mjs execution error.'
    );
  }
}

// ── 4. Template completeness ──────────────────────────────────────────────────
function checkTemplateCompleteness() {
  const templatesDir = path.join(cwd, 'docs', 'templates');
  if (!fs.existsSync(templatesDir)) {
    addFinding(
      'templates-dir-missing',
      'Task specification',
      'high',
      'docs/templates/ directory missing',
      'The docs/templates/ directory does not exist.',
      'Create docs/templates/ with required template files.'
    );
    return;
  }

  const requiredTemplates = {
    'story.md': ['## Summary', '## Acceptance Criteria'],
    'decision.md': ['## Decision', '## Rationale'],
    'validation-report.md': ['## Validation'],
    'harness-proposal.md': ['## Summary', '## Predicted Impact', '## Risk Assessment', '## Validation Plan', '## Rollback'],
  };

  for (const [file, requiredHeadings] of Object.entries(requiredTemplates)) {
    const fullPath = path.join(templatesDir, file);
    if (!fs.existsSync(fullPath)) {
      addFinding(
        `template-missing-${file.replace('.md', '')}`,
        'Task specification',
        'medium',
        `Template missing: docs/templates/${file}`,
        `docs/templates/${file} does not exist.`,
        `Create docs/templates/${file} with required headings: ${requiredHeadings.join(', ')}.`
      );
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const missingHeadings = requiredHeadings.filter(h => !content.includes(h));
    if (missingHeadings.length > 0) {
      addFinding(
        `template-incomplete-${file.replace('.md', '')}`,
        'Task specification',
        'low',
        `Template missing sections: docs/templates/${file}`,
        `Missing headings: ${missingHeadings.join(', ')}`,
        `Add missing sections to docs/templates/${file}.`
      );
    }
  }
}

// ── 5. Proposals pending ──────────────────────────────────────────────────────
function checkProposalsPending() {
  const proposalsDir = path.join(cwd, 'docs', 'proposals');
  if (!fs.existsSync(proposalsDir)) return;

  const files = fs.readdirSync(proposalsDir)
    .filter(f => f.endsWith('.md') && f !== '.gitkeep');

  let draftCount = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(proposalsDir, file), 'utf8');
    if (/\*\*Status:\*\*\s*draft/i.test(content)) {
      draftCount++;
    }
  }

  if (draftCount > 0) {
    addFinding(
      'proposals-pending-draft',
      'Entropy auditing',
      'low',
      `${draftCount} proposal(s) in draft status`,
      `${draftCount} file(s) in docs/proposals/ have Status: draft and have not been reviewed.`,
      'Review draft proposals in docs/proposals/ and set Status to approved or close them.'
    );
  }
}

// ── 6. Benchmark results ──────────────────────────────────────────────────────
function checkBenchmarkResults() {
  const benchmarkResultsDir = path.join(cwd, 'benchmark', 'results');
  if (!fs.existsSync(benchmarkResultsDir)) {
    addFinding(
      'benchmark-results-missing',
      'Observability',
      'medium',
      'benchmark/results/ directory missing',
      'benchmark/results/ does not exist. Without benchmark results the improvement loop is blind.',
      'Create benchmark/results/ and run benchmark/run-harness.mjs to generate baseline results.'
    );
    return;
  }

  const jsonlFiles = fs.readdirSync(benchmarkResultsDir)
    .filter(f => f.endsWith('.jsonl'));

  if (jsonlFiles.length === 0) {
    addFinding(
      'benchmark-results-empty',
      'Observability',
      'medium',
      'No benchmark result files found',
      'benchmark/results/ exists but contains no .jsonl files.',
      'Run benchmark/run-harness.mjs to generate benchmark results before proposing improvements.'
    );
  }
}

// ── Run all checks ────────────────────────────────────────────────────────────
function main() {
  checkHookCoverage();
  checkDocFreshness();
  checkAgentParity();
  checkTemplateCompleteness();
  checkProposalsPending();
  checkBenchmarkResults();

  const summary = {
    total: findings.length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };

  const output = {
    timestamp: new Date().toISOString(),
    findings,
    summary,
  };

  const json = JSON.stringify(output, null, 2);
  process.stdout.write(json + '\n');

  try {
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(outputFile, json);
  } catch (err) {
    process.stderr.write(`[h5-structural-audit] Failed to write state file: ${err.message}\n`);
  }

  process.exit(0);
}

main();
