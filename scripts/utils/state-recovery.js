'use strict';

/**
 * Crash recovery utilities for kg/runtime state files.
 */

const fs   = require('fs');
const path = require('path');
const { recoverIfCorrupt } = require('./atomic-write');

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * scanForStaleTemps — find *.tmp files older than 5 minutes in dir.
 * @param {string} dir
 * @returns {{ path: string, ageMs: number, likelyFor: string }[]}
 */
function scanForStaleTemps(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return results;
  }

  const now = Date.now();
  for (const entry of entries) {
    if (!entry.endsWith('.tmp')) continue;
    const full = path.join(dir, entry);
    try {
      const stat = fs.statSync(full);
      const ageMs = now - stat.mtimeMs;
      if (ageMs > STALE_THRESHOLD_MS) {
        results.push({
          path: full,
          ageMs,
          likelyFor: full.replace(/\.tmp$/, ''),
        });
      }
    } catch { /* skip */ }
  }
  return results;
}

/**
 * reportRecovery — scan dir for stale temps + corrupt JSON files, log to stderr.
 * @param {string} dir
 * @returns {{ staleTemps: number, corruptFiles: number }}
 */
function reportRecovery(dir) {
  let staleTemps = 0;
  let corruptFiles = 0;

  const temps = scanForStaleTemps(dir);
  staleTemps = temps.length;
  if (temps.length > 0) {
    process.stderr.write(`[state-recovery] ${temps.length} stale .tmp file(s) found in ${dir}:\n`);
    for (const t of temps) {
      process.stderr.write(`  ${t.path} (age: ${Math.round(t.ageMs / 1000)}s, likely for: ${t.likelyFor})\n`);
    }
  }

  let entries;
  try { entries = fs.readdirSync(dir); } catch { entries = []; }

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const full = path.join(dir, entry);
    const { recovered } = recoverIfCorrupt(full);
    if (recovered) corruptFiles++;
  }

  if (corruptFiles > 0) {
    process.stderr.write(`[state-recovery] ${corruptFiles} corrupt JSON file(s) recovered in ${dir}\n`);
  }

  return { staleTemps, corruptFiles };
}

module.exports = { scanForStaleTemps, reportRecovery };
