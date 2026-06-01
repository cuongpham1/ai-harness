#!/usr/bin/env node
/** Cursor subagentStart/Stop — trace + log (wraps existing hooks). */
import { execFileSync } from 'child_process';
import path from 'path';

const phase = process.argv[2] === 'stop' ? 'stop' : 'start';
const root = process.cwd();
const hooks = [
  'scripts/hooks/hud-agent-track.mjs',
  'scripts/hooks/subagent-log.js',
  'scripts/hooks/trace-logger.mjs',
];

for (const rel of hooks) {
  const script = path.join(root, rel);
  try {
    execFileSync(process.execPath, [script, phase], { stdio: 'inherit', timeout: 10000 });
  } catch { /* optional telemetry */ }
}
process.exit(0);
