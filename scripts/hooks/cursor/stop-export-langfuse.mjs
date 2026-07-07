#!/usr/bin/env node
/** Cursor stop — optional Langfuse export (wraps export-langfuse-trace.mjs). */
import { execFileSync } from 'child_process';
import path from 'path';

const hook = path.join(process.cwd(), 'scripts/hooks/export-langfuse-trace.mjs');
try {
    execFileSync(process.execPath, [hook], { stdio: 'inherit', timeout: 30000 });
} catch { /* non-fatal */ }
process.exit(0);
