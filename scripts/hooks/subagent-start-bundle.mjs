#!/usr/bin/env node
/** Run subagent start telemetry (Cursor lacks Claude SubagentStart hook). */
import { execFileSync } from 'child_process';
import path from 'path';

const root = process.cwd();
const hooks = [
  'scripts/hooks/hud-agent-track.mjs',
  'scripts/hooks/subagent-log.js',
  'scripts/hooks/trace-logger.mjs',
];

for (const rel of hooks) {
  try {
    execFileSync(process.execPath, [path.join(root, rel), 'start'], {
      stdio: 'inherit',
      timeout: 10000,
    });
  } catch { /* optional telemetry */ }
}
process.exit(0);
