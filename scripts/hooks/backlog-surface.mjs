#!/usr/bin/env node
/**
 * Stop hook — surface open backlog items at session end.
 * Shows proposed/accepted items (never blocks). Debounced: once per session.
 * Writes kg/runtime/backlog-surface-last.json
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
const cliPath = path.join(cwd, 'scripts', 'bin', 'harness-cli');
const stateFile = path.join(cwd, 'kg', 'runtime', 'backlog-surface-last.json');
const DEBOUNCE_MS = 10 * 60 * 1000; // 10 min — don't spam every Stop

if (!fs.existsSync(cliPath)) process.exit(0);

// Debounce
try {
  const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (st.at && (Date.now() - new Date(st.at).getTime()) < DEBOUNCE_MS) process.exit(0);
} catch { /* first run */ }

try {
  const raw = execFileSync(cliPath, ['query', 'backlog', '--open'], {
    cwd, encoding: 'utf8', timeout: 10000,
  });

  // Count real rows (skip header + separator)
  const rows = raw.trim().split('\n').filter(l => l.trim() && !l.startsWith('id') && !l.startsWith('--'));
  const count = rows.length;

  const state = { at: new Date().toISOString(), open_count: count };
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  if (count > 0) {
    process.stderr.write(`[backlog-surface] ${count} open backlog item(s) pending review:\n`);
    // Show first 3 items
    rows.slice(0, 3).forEach(r => process.stderr.write(`  ${r.trim()}\n`));
    if (count > 3) process.stderr.write(`  ... and ${count - 3} more. Run: scripts/bin/harness-cli query backlog --open\n`);
  }
} catch (err) {
  // Silent fail — non-blocking
}
process.exit(0);
