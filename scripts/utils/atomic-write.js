'use strict';

/**
 * Atomic file write utilities.
 *
 * Uses write-to-temp + fs.renameSync — atomic on any POSIX filesystem
 * and on Windows (same volume). Prevents truncated/corrupt state files
 * if the process is killed mid-write.
 */

const fs   = require('fs');
const path = require('path');

/**
 * Write content to filePath atomically.
 * Creates parent directories if needed.
 */
function writeAtomic(filePath, content) {
  const tmp = filePath + '.tmp';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

/**
 * Append a line to filePath atomically (read → append → write).
 * Creates the file if it doesn't exist.
 */
function appendAtomic(filePath, line) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let existing = '';
  try { existing = fs.readFileSync(filePath, 'utf8'); } catch { /* new file */ }
  writeAtomic(filePath, existing + line);
}

/**
 * Write with versioned backup. Keeps last `maxVersions` copies as .bak.N
 * filePath.bak.0 = previous, .bak.1 = one before that, etc.
 */
function writeAtomicVersioned(filePath, content, maxVersions = 3) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  // Rotate existing backups: .bak.1 → .bak.2, .bak.0 → .bak.1
  for (let i = maxVersions - 2; i >= 0; i--) {
    const src = `${filePath}.bak.${i}`;
    const dst = `${filePath}.bak.${i + 1}`;
    try { fs.renameSync(src, dst); } catch { /* not present */ }
  }

  // Save current file as .bak.0 before overwriting
  try { fs.copyFileSync(filePath, `${filePath}.bak.0`); } catch { /* first write */ }

  writeAtomic(filePath, content);
}

/**
 * Read file; if corrupt/missing, write defaultContent and return it.
 * Returns { recovered: bool, content: string }
 */
function recoverIfCorrupt(filePath, defaultContent = '{}') {
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    try { writeAtomic(filePath, defaultContent); } catch { /* ignore */ }
    return { recovered: true, content: defaultContent };
  }

  if (!raw) {
    try { writeAtomic(filePath, defaultContent); } catch { /* ignore */ }
    return { recovered: true, content: defaultContent };
  }

  try {
    JSON.parse(raw);
    return { recovered: false, content: raw };
  } catch {
    try { writeAtomic(filePath, defaultContent); } catch { /* ignore */ }
    return { recovered: true, content: defaultContent };
  }
}

module.exports = { writeAtomic, appendAtomic, writeAtomicVersioned, recoverIfCorrupt };
