#!/usr/bin/env node
/**
 * CI drift gate — .cursor/agents body must match .claude/agents (after frontmatter).
 * Run: node scripts/check-agent-parity.mjs [target_dir]
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const root = path.resolve(process.argv[2] || process.cwd());
const claudeDir = path.join(root, '.claude', 'agents');
const cursorDir = path.join(root, '.cursor', 'agents');

const FRONTMATTER = /^---\n[\s\S]*?\n---\n([\s\S]*)$/;

function bodyHash(text) {
  const m = text.match(FRONTMATTER);
  const body = (m ? m[1] : text).trim().replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(body).digest('hex');
}

if (!fs.existsSync(claudeDir)) {
  console.error('Missing .claude/agents');
  process.exit(1);
}
if (!fs.existsSync(cursorDir)) {
  console.error('Missing .cursor/agents — run: node scripts/sync-cursor-agents.mjs');
  process.exit(1);
}

const claudeFiles = fs.readdirSync(claudeDir).filter((f) => f.endsWith('.md'));
let failed = 0;

for (const file of claudeFiles) {
  const claudePath = path.join(claudeDir, file);
  const cursorPath = path.join(cursorDir, file);
  if (!fs.existsSync(cursorPath)) {
    console.error(`MISSING cursor agent: ${file}`);
    failed++;
    continue;
  }
  const a = bodyHash(fs.readFileSync(claudePath, 'utf8'));
  const b = bodyHash(fs.readFileSync(cursorPath, 'utf8'));
  if (a !== b) {
    console.error(`DRIFT ${file} (body hash mismatch — run: node scripts/sync-cursor-agents.mjs)`);
    failed++;
  }
}

const cursorOnly = fs
  .readdirSync(cursorDir)
  .filter((f) => f.endsWith('.md') && !claudeFiles.includes(f));
for (const file of cursorOnly) {
  console.error(`EXTRA cursor-only agent: ${file}`);
  failed++;
}

if (failed) {
  console.error(`\nAgent parity check FAILED (${failed} issue(s))`);
  process.exit(1);
}
console.log(`Agent parity OK (${claudeFiles.length} agents)`);
