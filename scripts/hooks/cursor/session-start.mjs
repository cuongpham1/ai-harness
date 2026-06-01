#!/usr/bin/env node
/**
 * Cursor sessionStart — inject .project-manager state (wraps session-start-pm.js).
 */
import { execFileSync } from 'child_process';
import path from 'path';

const root = process.cwd();
const hook = path.join(root, 'scripts/hooks/session-start-pm.js');

try {
  const out = execFileSync(process.execPath, [hook], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
  const parsed = JSON.parse(out.trim());
  const ctx = parsed?.hookSpecificOutput?.additionalContext
    || parsed?.additionalContext
    || '';
  if (ctx) {
    process.stdout.write(JSON.stringify({ additional_context: ctx }));
  }
} catch {
  // no-op
}
process.exit(0);
