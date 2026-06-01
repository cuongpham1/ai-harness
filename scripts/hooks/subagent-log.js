#!/usr/bin/env node
/**
 * SubagentStart / SubagentStop hook — lightweight observability log.
 *
 * Appends one line per event to kg/runtime/subagent.log:
 *   2026-04-14T10:00:00Z [START] @coder — "implement user auth"
 *   2026-04-14T10:05:23Z [STOP]  @coder — DONE_WITH_CONCERNS
 *
 * Usage (settings.json):
 *   SubagentStart: node scripts/hooks/subagent-log.js start
 *   SubagentStop:  node scripts/hooks/subagent-log.js stop
 *
 * Always exits 0 — never blocks agent execution.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { writeAtomic, appendAtomic } = require('../utils/atomic-write');
const { appendDual } = require('../utils/kg-paths');

const MAX_LINES = 500; // trim log khi quá dài

const event = process.argv[2] === 'stop' ? 'STOP ' : 'START';

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', () => resolve(''));
    // Timeout nếu stdin không có gì
    setTimeout(() => resolve(data.trim()), 500);
  });
}

function extractLabel(payload) {
  try {
    const obj = JSON.parse(payload);

    // SubagentStart: tool_input có thể chứa subagent_type và prompt
    const toolInput = obj.tool_input || obj.toolInput || {};
    const type = toolInput.subagent_type || toolInput.type || obj.subagent_type || '';
    const prompt = toolInput.prompt || '';
    const description = toolInput.description || '';

    const label = type ? `@${type}` : 'subagent';
    const detail = description || (prompt ? prompt.slice(0, 80).replace(/\n/g, ' ') : '');

    // SubagentStop: có thể có result/status
    const result = obj.result || obj.status || '';

    return { label, detail, result };
  } catch {
    return { label: 'subagent', detail: '', result: '' };
  }
}

function trimLog(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > MAX_LINES) {
      writeAtomic(filePath, lines.slice(-MAX_LINES).join('\n') + '\n');
    }
  } catch { /* ignore */ }
}

async function main() {
  const payload = await readStdin();
  const { label, detail, result } = extractLabel(payload);

  const ts = new Date().toISOString();
  let line;
  if (event === 'START') {
    line = `${ts} [START] ${label}${detail ? ` — "${detail}"` : ''}`;
  } else {
    line = `${ts} [STOP ] ${label}${result ? ` — ${result}` : ''}`;
  }

  try {
    // Single-write to kg/runtime only (Phase 2B)
    appendDual('subagent.log', line + '\n', appendAtomic);
    // Trim the kg/runtime log (source of truth)
    const { getKgPath } = require('../utils/kg-paths');
    trimLog(getKgPath('subagent.log'));
  } catch { /* ignore */ }
}

main().catch(() => {}).finally(() => process.exit(0));
