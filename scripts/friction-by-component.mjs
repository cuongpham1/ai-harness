#!/usr/bin/env node
/**
 * Group harness friction by HARNESS_COMPONENTS responsibility.
 * Usage:
 *   node scripts/friction-by-component.mjs
 *   node scripts/friction-by-component.mjs --json
 *   node scripts/friction-by-component.mjs --check   # exit 1 if no friction rows
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const TAG_MAP = {
  'docs-stale': { num: 2, name: 'context_selection', label: 'Context selection' },
  'context-bloat': { num: 2, name: 'context_selection', label: 'Context selection' },
  'hook-gap': { num: 6, name: 'observability', label: 'Observability' },
  'proof-gap': { num: 8, name: 'verification', label: 'Verification' },
  'dual-track': { num: 5, name: 'task_state', label: 'Task state' },
  'tool-gap': { num: 3, name: 'tool_access', label: 'Tool access' },
  'perm-gap': { num: 9, name: 'permissions', label: 'Permissions' },
  'memory-gap': { num: 4, name: 'project_memory', label: 'Project memory' },
};

const cwd = (() => {
  try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); }
})();
const cliPath = path.join(cwd, 'scripts', 'bin', 'harness-cli');
const jsonOut = process.argv.includes('--json');
const checkMode = process.argv.includes('--check');

function extractTag(friction) {
  if (!friction || /^none$/i.test(friction.trim())) return null;
  const m = friction.trim().match(/^([a-z][a-z0-9-]*)/i);
  return m ? m[1].toLowerCase() : 'untagged';
}

function parseFrictionRows(output) {
  const lines = output.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('|').map(p => p.trim());
    if (parts.length < 6) continue;
    rows.push({
      id: parts[0],
      created_at: parts[1],
      risk_lane: parts[2],
      input_type: parts[3],
      task_summary: parts[4],
      harness_friction: parts[5],
    });
  }
  return rows;
}

function groupRows(rows) {
  const groups = {};
  const untagged = [];

  for (const row of rows) {
    const tag = extractTag(row.harness_friction);
    if (!tag || tag === 'untagged') {
      untagged.push(row);
      continue;
    }
    const meta = TAG_MAP[tag] || {
      num: 0,
      name: 'unmapped',
      label: 'Unmapped',
    };
    const key = meta.name;
    if (!groups[key]) {
      groups[key] = { ...meta, count: 0, examples: [] };
    }
    groups[key].count++;
    if (groups[key].examples.length < 3) {
      groups[key].examples.push({ tag, friction: row.harness_friction, task: row.task_summary });
    }
  }

  return { groups, untagged };
}

function main() {
  if (!fs.existsSync(cliPath)) {
    if (checkMode) process.exit(0);
    console.error('harness-cli not found');
    process.exit(1);
  }

  let output;
  try {
    output = execFileSync(cliPath, ['query', 'friction'], {
      cwd,
      encoding: 'utf8',
      timeout: 10000,
    });
  } catch (err) {
    output = err.stdout?.toString() || '';
  }

  const rows = parseFrictionRows(output);
  const { groups, untagged } = groupRows(rows);

  if (checkMode) {
    process.exit(rows.length > 0 ? 0 : 1);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalFrictionRows: rows.length,
    taggedTags: Object.keys(TAG_MAP).length,
    components: Object.values(groups).sort((a, b) => b.count - a.count),
    unmappedCount: untagged.length,
  };

  if (jsonOut) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }

  console.log('=== Friction by Component ===');
  console.log(`Total friction rows: ${rows.length}`);
  console.log('');
  console.log('component              | count | responsibility');
  console.log('-----------------------|-------|------------------');
  for (const g of report.components) {
    console.log(
      `${g.label.padEnd(22)} | ${String(g.count).padStart(5)} | #${g.num} ${g.name}`,
    );
    for (const ex of g.examples) {
      console.log(`  - [${ex.tag}] ${ex.friction.slice(0, 60)}`);
    }
  }
  if (untagged.length) {
    console.log('');
    console.log(`Untagged/unmapped: ${untagged.length}`);
  }
}

main();
