#!/usr/bin/env node
/**
 * Cursor postToolUse — audit file edits + PM readme updates.
 */
import { execFileSync } from 'child_process';
import path from 'path';
import { readStdinJson } from './lib.mjs';

const input = await readStdinJson();
const tool = input.tool_name || input.tool || '';
const root = process.cwd();

const run = (script) => {
  try {
    execFileSync(process.execPath, [script], {
      cwd: root,
      input: JSON.stringify(input),
      stdio: ['pipe', 'inherit', 'inherit'],
      timeout: 15000,
    });
  } catch { /* audit hooks are non-fatal */ }
};

if (/Write|Edit|ApplyPatch/i.test(tool)) {
  run(path.join(root, 'scripts/hooks/post-tool-task-tracker.js'));
  run(path.join(root, 'scripts/hooks/update-pm-readme.js'));
}
if (/Shell|Bash/i.test(tool)) {
  run(path.join(root, 'scripts/hooks/post-commit-archaeologist.js'));
}
process.exit(0);
