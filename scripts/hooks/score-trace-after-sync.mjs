#!/usr/bin/env node
/**
 * Stop hook — run score-trace after sync; warn if below lane requirement.
 * Writes kg/runtime/trace-score-last.json. Never blocks session.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const cwd = (() => {
  try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); }
})();
const cliPath = path.join(cwd, 'scripts', 'bin', 'harness-cli');
const outFile = path.join(cwd, 'kg', 'runtime', 'trace-score-last.json');

if (!fs.existsSync(cliPath)) {
  process.exit(0);
}

try {
  const raw = execFileSync(cliPath, ['score-trace'], {
    cwd,
    encoding: 'utf8',
    timeout: 15000,
  });

  const result = {
    scoredAt: new Date().toISOString(),
    exitCode: 0,
    output: raw.trim(),
    belowRequirement: /BELOW REQUIREMENT/i.test(raw),
    meetsRequirement: /MEETS REQUIREMENT/i.test(raw),
  };

  const tierMatch = raw.match(/Tier achieved:\s*(\w+)\s*\((\d)\/3\)/);
  if (tierMatch) {
    result.tierLabel = tierMatch[1];
    result.tierScore = Number(tierMatch[2]);
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

  if (result.belowRequirement) {
    process.stderr.write(
      `[score-trace-after-sync] Trace BELOW lane requirement — run: scripts/bin/harness-cli score-trace\n`,
    );
  }
} catch (err) {
  const stdout = err.stdout?.toString?.() || '';
  const stderr = err.stderr?.toString?.() || '';
  const combined = (stdout + stderr).trim();
  const below = /BELOW REQUIREMENT/i.test(combined);
  const exitCode = err.status ?? 1;

  const result = {
    scoredAt: new Date().toISOString(),
    exitCode,
    output: combined || err.message,
    belowRequirement: below,
    meetsRequirement: /MEETS REQUIREMENT/i.test(combined),
  };

  try {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  } catch { /* ignore */ }

  if (below || exitCode !== 0) {
    process.stderr.write(
      `[score-trace-after-sync] ${below ? 'Trace BELOW requirement' : 'score-trace failed'} (exit ${exitCode})\n`,
    );
  }
}

process.exit(0);
