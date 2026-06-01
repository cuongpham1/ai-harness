#!/usr/bin/env node
/**
 * SubagentStart / SubagentStop structured trace logger.
 *
 * Usage:
 *   SubagentStart: node scripts/hooks/trace-logger.mjs start
 *   SubagentStop:  node scripts/hooks/trace-logger.mjs stop
 *
 * Writes structured JSONL to kg/traces/YYYY-MM-DD.jsonl
 * Maintains pending map in kg/runtime/trace-pending.json
 * Always exits 0 — never blocks.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CWD = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();

const KG_RUNTIME = path.join(CWD, 'kg', 'runtime');
const KG_TRACES  = path.join(CWD, 'kg', 'traces');
const PENDING_FILE = path.join(KG_RUNTIME, 'trace-pending.json');

const mode = process.argv[2] === 'stop' ? 'stop' : 'start';

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(data.trim()), 500);
  });
}

function tracePath() {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10);
  return path.join(KG_TRACES, `${dateStr}.jsonl`);
}

function writeAtomic(filePath, content) {
  const tmp = filePath + '.tmp';
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function appendJsonl(filePath, obj) {
  ensureDir(path.dirname(filePath));
  const line = JSON.stringify(obj) + '\n';
  fs.appendFileSync(filePath, line, 'utf8');
}

function loadPending() {
  try {
    return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function savePending(map) {
  writeAtomic(PENDING_FILE, JSON.stringify(map, null, 2));
}

function generateAgentId(type) {
  const ts = Date.now();
  const safe = (type || 'unknown').replace(/[^a-z0-9]/gi, '_');
  return `${safe}_${ts}`;
}

async function handleStart(raw) {
  let payload = {};
  try { payload = JSON.parse(raw); } catch { /* ignore */ }

  const toolInput = payload.tool_input || payload.toolInput || {};
  const agentType = toolInput.subagent_type || toolInput.type || payload.subagent_type || 'unknown';
  const description = toolInput.description || toolInput.prompt?.slice(0, 120).replace(/\n/g, ' ') || '';
  const agentId = generateAgentId(agentType);
  const ts = new Date().toISOString();

  const pending = loadPending();
  pending[agentId] = { agentType, startTs: ts };
  savePending(pending);

  appendJsonl(tracePath(), {
    ts,
    event: 'agent_start',
    agentType,
    description,
    agentId,
  });
}

async function handleStop(raw) {
  let payload = {};
  try { payload = JSON.parse(raw); } catch { /* ignore */ }

  const toolInput = payload.tool_input || payload.toolInput || {};
  const agentType = toolInput.subagent_type || toolInput.type || payload.subagent_type || 'unknown';
  const result = payload.result || payload.status || payload.stop_reason || '';
  const ts = new Date().toISOString();

  const pending = loadPending();

  // Find matching agentId by agentType — pick newest (highest startTs)
  let matchedId = null;
  let matchedStartTs = null;
  let durationMs = null;

  for (const [id, entry] of Object.entries(pending)) {
    if (entry.agentType === agentType) {
      if (matchedStartTs === null || entry.startTs > matchedStartTs) {
        matchedId = id;
        matchedStartTs = entry.startTs;
      }
    }
  }
  if (matchedId) {
    durationMs = Date.now() - new Date(matchedStartTs).getTime();
  }

  if (matchedId) {
    delete pending[matchedId];
    savePending(pending);
  }

  appendJsonl(tracePath(), {
    ts,
    event: 'agent_stop',
    agentType,
    result: String(result),
    durationMs,
    agentId: matchedId || generateAgentId(agentType),
  });
}

async function main() {
  ensureDir(KG_RUNTIME);
  ensureDir(KG_TRACES);

  const raw = await readStdin();

  if (mode === 'start') {
    await handleStart(raw);
  } else {
    await handleStop(raw);
  }
}

main().catch(() => {}).finally(() => process.exit(0));
