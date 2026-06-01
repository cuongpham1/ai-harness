#!/usr/bin/env node
import { execFileSync } from 'child_process';
import path from 'path';

const hook = path.join(process.cwd(), 'scripts/hooks/run-harness-verify.mjs');
try {
  execFileSync(process.execPath, [hook], { stdio: 'inherit', timeout: 600000 });
} catch (e) {
  process.exit(typeof e.status === 'number' ? e.status : 2);
}
