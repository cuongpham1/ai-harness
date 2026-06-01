'use strict';

const fs   = require('fs');
const path = require('path');

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
const KG_RUNTIME = path.join(cwd, 'kg', 'runtime');

function getKgPath(filename) {
  return path.join(KG_RUNTIME, filename);
}

function ensureDir(dirPath) {
  try { fs.mkdirSync(dirPath, { recursive: true }); } catch { /* ignore */ }
}

/**
 * Append content to kg/runtime/<filename>.
 * @param {string} filename
 * @param {string} content
 * @param {function} appendFn  — atomic append function from atomic-write.js
 */
function appendDual(filename, content, appendFn) {
  ensureDir(KG_RUNTIME);
  appendFn(getKgPath(filename), content);
}

/**
 * Write content to kg/runtime/<filename>.
 * @param {string} filename
 * @param {string} content
 * @param {function} writeFn  — atomic write function from atomic-write.js
 */
function writeDual(filename, content, writeFn) {
  ensureDir(KG_RUNTIME);
  writeFn(getKgPath(filename), content);
}

/**
 * Read kg/runtime/<filename>. Returns null on any error.
 */
function readWithFallback(filename) {
  try { return fs.readFileSync(getKgPath(filename), 'utf8').trim(); } catch { return null; }
}

module.exports = { getKgPath, appendDual, writeDual, readWithFallback };
