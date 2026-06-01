#!/usr/bin/env node
/** Cursor stop — sync After-Work to harness.db */
import { execFileSync } from 'child_process';
import path from 'path';

const hook = path.join(process.cwd(), 'scripts/hooks/sync-harness-trace.mjs');
try {
  execFileSync(process.execPath, [hook], { stdio: 'inherit', timeout: 30000 });
} catch { /* non-fatal */ }
process.exit(0);
