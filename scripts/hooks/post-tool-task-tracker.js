#!/usr/bin/env node
'use strict';

/**
 * PostToolUse Hook — append file edit events vào events.jsonl.
 *
 * Khi Claude Edit/Write một file:
 *   - Ghi 1 dòng JSON vào kg/runtime/events.jsonl
 *   - Bỏ qua kg/, .project-manager/, .project-info/, .claude/, node_modules/
 *
 * Always exits 0 — không bao giờ block tool execution.
 *
 * NOTE: Task tracking (in-progress.md) là PM's responsibility, không phải hook.
 *       Hook chỉ ghi audit log để PM/user có thể query sau.
 */

const fs = require('fs');
const path = require('path');
const { appendAtomic } = require('../utils/atomic-write');
const { appendDual } = require('../utils/kg-paths');

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();

const SKIP_PREFIXES = ['kg', '.project-manager', '.project-info', '.claude', 'node_modules', '.git'];

function shouldSkip(relPath) {
  return SKIP_PREFIXES.some(prefix => relPath.startsWith(prefix));
}

function realPathSafe(p) {
  try { return fs.realpathSync(p); } catch { /* file may not exist yet */ }
  try { return path.join(fs.realpathSync(path.dirname(p)), path.basename(p)); } catch { /* ignore */ }
  return p;
}

// Keep events.jsonl under 2000 lines
const MAX_LINES = 2000;
const TRIM_TO   = 1500;

function trimIfNeeded(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > MAX_LINES) {
      const trimmed = lines.slice(lines.length - TRIM_TO).join('\n') + '\n';
      fs.writeFileSync(filePath + '.tmp', trimmed, 'utf8');
      fs.renameSync(filePath + '.tmp', filePath);
    }
  } catch { /* ignore */ }
}

function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);

    const toolName = input.tool_name;
    if (toolName !== 'Edit' && toolName !== 'Write') return;

    const filePath = input.tool_input?.file_path;
    if (!filePath) return;

    const rel = path.relative(cwd, realPathSafe(path.resolve(filePath)));
    if (shouldSkip(rel)) return;

    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      event: 'file_edited',
      tool: toolName,
      file: rel,
    });

    // Single-write to kg/runtime only (Phase 2B)
    appendDual('events.jsonl', entry + '\n', appendAtomic);
    // Trim the kg/runtime log (source of truth)
    const { getKgPath } = require('../utils/kg-paths');
    trimIfNeeded(getKgPath('events.jsonl'));
  } catch (err) {
    process.stderr.write(`[TaskTracker] ${err.message}\n`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

const MAX_STDIN = 512 * 1024;
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
});
process.stdin.on('end', () => {
  run(data);
  process.exit(0);
});
