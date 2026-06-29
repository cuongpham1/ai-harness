#!/usr/bin/env node
/**
 * Merge harness hook entries into a target project's .claude/settings.json.
 *
 * Usage: node merge-settings-hooks.mjs <HARNESS_DIR> <TARGET_DIR>
 *
 * Why: install.sh upgrade mode skips an existing settings.json ("skipped,
 * exists"), so newly-wired hooks (e.g. SubagentStop pipeline-checkpoint,
 * PreCompact reset) never reach copy-mode projects even when the hook file is
 * copied. This merges any harness hook command the target is missing, keyed by
 * script basename + argument tail, without clobbering user customizations.
 *
 * Idempotent: re-running adds nothing if every harness hook is already present.
 * If the target has no settings.json yet, does nothing (fresh install copies
 * the whole file).
 */

import fs from 'fs';
import path from 'path';

const [, , HARNESS_DIR, TARGET_DIR] = process.argv;
if (!HARNESS_DIR || !TARGET_DIR) {
  process.stderr.write('usage: merge-settings-hooks.mjs <HARNESS_DIR> <TARGET_DIR>\n');
  process.exit(1);
}

const harnessFile = path.join(HARNESS_DIR, '.claude', 'settings.json');
const targetFile = path.join(TARGET_DIR, '.claude', 'settings.json');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const harness = readJson(harnessFile);
const target = readJson(targetFile);

// Fresh install (no target settings) or unreadable harness → nothing to merge.
if (!harness?.hooks) process.exit(0);
if (!target) { console.log('  ~ .claude/settings.json (absent — fresh copy handles it)'); process.exit(0); }
if (target.hooks && typeof target.hooks !== 'object') process.exit(0);
target.hooks = target.hooks || {};

// Symlinked settings.json already tracks the harness — skip.
try {
  if (fs.realpathSync(harnessFile) === fs.realpathSync(targetFile)) {
    console.log('  ~ .claude/settings.json (symlinked, skip)');
    process.exit(0);
  }
} catch { /* not symlinked */ }

/** Identity for a single hook command: script basename + arg tail. */
function hookKey(cmd) {
  if (typeof cmd !== 'string') return JSON.stringify(cmd);
  // node "$CLAUDE_PROJECT_DIR"/scripts/hooks/foo.mjs stop  →  foo.mjs stop
  const m = cmd.match(/([\w.-]+\.(?:mjs|js|sh|cjs))(.*)$/);
  if (!m) return cmd.trim();
  return (m[1] + m[2]).replace(/["']/g, '').trim();
}

/** All hook command keys present in a target event's group list. */
function existingKeys(groups) {
  const keys = new Set();
  for (const g of groups || []) {
    for (const h of g.hooks || []) keys.add(hookKey(h.command));
  }
  return keys;
}

let added = 0;
for (const [event, harnessGroups] of Object.entries(harness.hooks)) {
  if (!Array.isArray(harnessGroups)) continue;
  if (!Array.isArray(target.hooks[event])) target.hooks[event] = [];
  const present = existingKeys(target.hooks[event]);

  for (const group of harnessGroups) {
    // A group can hold multiple hooks; add it if ANY of its hooks is missing.
    const groupKeys = (group.hooks || []).map(h => hookKey(h.command));
    const missing = groupKeys.filter(k => !present.has(k));
    if (missing.length === 0) continue;
    target.hooks[event].push(group);
    missing.forEach(k => { present.add(k); console.log(`  ✓ hook ${event}: ${k}`); added++; });
  }
}

if (added === 0) {
  console.log('  ~ .claude/settings.json hooks (already current)');
  process.exit(0);
}

// Atomic write, 4-space indent to match the installed file's style.
const tmp = targetFile + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(target, null, 4) + '\n', 'utf8');
fs.renameSync(tmp, targetFile);
console.log(`  ✓ .claude/settings.json (merged ${added} hook entr${added === 1 ? 'y' : 'ies'})`);
