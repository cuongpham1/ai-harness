#!/usr/bin/env node
/**
 * Cursor stop — block if in_progress tasks lack After-Work (wraps check-task-handoff.js).
 */
import { execFileSync } from 'child_process';
import path from 'path';

const root = process.cwd();
const hook = path.join(root, 'scripts/hooks/check-task-handoff.js');

try {
  execFileSync(process.execPath, [hook], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
} catch (err) {
  const stderr = err.stderr?.toString() || err.message || 'Missing After-Work on in_progress task.';
  process.stdout.write(JSON.stringify({
    followup_message: `${stderr}\n\nAppend structured ### After-Work to each in_progress task file, then finish.`,
  }));
  process.exit(2);
}
process.exit(0);
