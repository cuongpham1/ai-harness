#!/usr/bin/env node
/** Cursor stop — score trace after sync (wraps score-trace-after-sync.mjs). */
import { execFileSync } from 'child_process';
import path from 'path';

const hook = path.join(process.cwd(), 'scripts/hooks/score-trace-after-sync.mjs');
try {
  execFileSync(process.execPath, [hook], { stdio: 'inherit', timeout: 20000 });
} catch { /* non-fatal */ }
process.exit(0);
