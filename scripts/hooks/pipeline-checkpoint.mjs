#!/usr/bin/env node
/**
 * SubagentStop hook — pipeline-step checkpoint (backlog-27).
 *
 * Records which pipeline stage just completed for the active task into
 * kg/runtime/pipeline-state.json. On crash/retry, session-start-pm.js reads
 * this file and surfaces "resume from <nextStage>" instead of restarting the
 * pipeline at coder.
 *
 * Pipeline by lane (docs/FEATURE_INTAKE.md):
 *   tiny      → coder
 *   normal    → coder → spec-reviewer → reviewer → tester
 *   high-risk → solution-architect → coder → spec-reviewer → reviewer → tester
 *
 * Agent type resolution: payload.subagent_type first, then the newest entry in
 * kg/runtime/trace-pending.json (written by trace-logger.mjs at SubagentStart).
 * This hook MUST run before trace-logger's stop handler, which clears pending.
 *
 * Always exits 0 — never blocks agent execution.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CWD = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();

const KG_RUNTIME = path.join(CWD, 'kg', 'runtime');
const STATE_FILE = path.join(KG_RUNTIME, 'pipeline-state.json');
const PENDING_FILE = path.join(KG_RUNTIME, 'trace-pending.json');
const TASKS_DIR = path.join(CWD, '.project-manager', 'tasks');

const STAGES_BY_LANE = {
  tiny: ['coder'],
  normal: ['coder', 'spec-reviewer', 'reviewer', 'tester'],
  high_risk: ['solution-architect', 'coder', 'spec-reviewer', 'reviewer', 'tester'],
};

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

function writeAtomic(filePath, content) {
  ensureDir(path.dirname(filePath));
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

/** Map any agent label to a canonical pipeline stage, or null if not a stage. */
export function normalizeStage(raw) {
  if (!raw) return null;
  const t = String(raw).toLowerCase();
  if (t.includes('architect')) return 'solution-architect';
  if (t.includes('spec')) return 'spec-reviewer';
  if (t.includes('review')) return 'reviewer';
  if (t.includes('test')) return 'tester';
  if (t.includes('cod')) return 'coder'; // coder, codegen
  return null;
}

function normalizeLane(raw) {
  if (!raw) return 'normal';
  const t = String(raw).toLowerCase().replace(/[\s-]/g, '_');
  if (t.startsWith('tiny')) return 'tiny';
  if (t.startsWith('high')) return 'high_risk';
  return 'normal';
}

/** Resolve agent type: payload first, then newest pending trace entry. */
function resolveAgentType(payload) {
  const toolInput = payload.tool_input || payload.toolInput || {};
  const direct = toolInput.subagent_type || toolInput.type || payload.subagent_type;
  if (direct) return direct;
  try {
    const pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    let newest = null;
    let newestTs = null;
    for (const entry of Object.values(pending)) {
      if (newestTs === null || entry.startTs > newestTs) {
        newestTs = entry.startTs;
        newest = entry.agentType;
      }
    }
    return newest;
  } catch {
    return null;
  }
}

/** First in_progress task file → { id, lane }. Newest by filename sort. */
export function resolveActiveTask(tasksDir = TASKS_DIR) {
  let files;
  try {
    files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md')).sort();
  } catch {
    return null;
  }
  let match = null;
  for (const file of files) {
    let content;
    try { content = fs.readFileSync(path.join(tasksDir, file), 'utf8'); } catch { continue; }
    const status = (content.match(/\*\*Status:\*\*\s*(\S+)/) || [])[1]?.toLowerCase();
    if (status !== 'in_progress') continue;
    const lane = normalizeLane((content.match(/\*\*Lane:\*\*\s*(\S+)/) || [])[1]);
    match = { id: file.replace(/\.md$/, ''), lane }; // keep last (newest) in_progress
  }
  return match;
}

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.tasks) return parsed;
  } catch { /* fresh */ }
  return { version: 1, tasks: {} };
}

/**
 * Pure reducer: record `stage` complete for `task` in `state`. Returns new state.
 * Exported for tests.
 */
export function recordStage(state, task, stage, result, ts) {
  const stages = STAGES_BY_LANE[task.lane] || STAGES_BY_LANE.normal;
  if (!stages.includes(stage)) return state; // stage not part of this lane's pipeline
  const tasks = { ...state.tasks };
  const prev = tasks[task.id] || { lane: task.lane, completed: [] };
  const completed = prev.completed.includes(stage)
    ? prev.completed
    : stages.filter(s => prev.completed.includes(s) || s === stage); // keep canonical order
  const nextStage = stages.find(s => !completed.includes(s)) || null;
  tasks[task.id] = {
    lane: task.lane,
    stages,
    completed,
    lastStage: stage,
    lastResult: result || null,
    nextStage,
    done: nextStage === null,
    updatedAt: ts,
  };
  return { ...state, tasks };
}

async function main() {
  const raw = await readStdin();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }

  const stage = normalizeStage(resolveAgentType(payload));
  if (!stage) return; // not a pipeline agent (investigator, builder, etc.)

  const task = resolveActiveTask();
  if (!task) return; // no active task to attach checkpoint to

  const result = payload.result || payload.status || payload.stop_reason || null;
  const ts = new Date().toISOString();

  const next = recordStage(loadState(), task, stage, result, ts);
  writeAtomic(STATE_FILE, JSON.stringify(next, null, 2));
}

// Only run as a hook when invoked directly (not when imported by tests).
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    process.stderr.write(`[pipeline-checkpoint] ${err.message}\n`);
  }).finally(() => process.exit(0));
}
