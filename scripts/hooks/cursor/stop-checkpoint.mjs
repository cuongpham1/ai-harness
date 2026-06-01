#!/usr/bin/env node
/** Cursor stop — session checkpoint */
import { execFileSync } from 'child_process';
import path from 'path';

const hook = path.join(process.cwd(), 'scripts/hooks/auto-checkpoint.js');
try {
  execFileSync(process.execPath, [hook], { stdio: 'inherit', timeout: 15000 });
} catch { /* non-fatal */ }
process.exit(0);
