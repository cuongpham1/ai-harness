#!/usr/bin/env node
/**
 * Stop hook — sync structured After-Work notes from task files to harness-cli trace.
 * Links intake from task **Lane:** so score-trace can check lane requirements.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const cwd = (() => {
  try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); }
})();

const tasksDir = path.join(cwd, '.project-manager', 'tasks');
const stateFile = path.join(cwd, 'kg', 'runtime', 'trace-sync-state.json');
const intakeMapFile = path.join(cwd, 'kg', 'runtime', 'task-intake-map.json');
const cliPath = path.join(cwd, 'scripts', 'bin', 'harness-cli');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function loadState() {
  try { return JSON.parse(readFileSafe(stateFile) || '{}'); } catch { return {}; }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function loadIntakeMap() {
  try { return JSON.parse(readFileSafe(intakeMapFile) || '{}'); } catch { return {}; }
}

function saveIntakeMap(map) {
  fs.mkdirSync(path.dirname(intakeMapFile), { recursive: true });
  fs.writeFileSync(intakeMapFile, JSON.stringify(map, null, 2));
}

function parseAfterWorkSections(content) {
  const sections = [];
  const re = /### After-Work — ([^\n]+)\n([\s\S]*?)(?=### After-Work —|$)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    sections.push({ date: m[1].trim(), body: m[2] });
  }
  return sections;
}

function field(body, name) {
  const re = new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|$)`, 'is');
  const m = body.match(re);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '';
}

function taskField(content, name) {
  const re = new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+?)(?=\\n|$)`, 'i');
  const m = content.match(re);
  return m ? m[1].trim() : '';
}

function taskTitle(content, taskId) {
  const m = content.match(/^# Task:\s*(.+)$/m);
  return m ? m[1].trim() : taskId;
}

function normalizeLane(raw) {
  if (!raw) return 'normal';
  const lane = raw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (lane === 'high_risk' || lane === 'highrisk') return 'high_risk';
  if (lane === 'tiny' || lane === 'normal') return lane;
  return 'normal';
}

function resolveIntakeId(taskId, taskContent) {
  const map = loadIntakeMap();
  if (map[taskId]) return map[taskId];

  if (!fs.existsSync(cliPath)) return null;

  const lane = normalizeLane(taskField(taskContent, 'Lane'));
  const summary = taskTitle(taskContent, taskId);
  const notes = `task:${taskId}`;

  try {
    const out = execFileSync(cliPath, [
      'intake',
      '--type', 'change_request',
      '--summary', summary.slice(0, 200),
      '--lane', lane,
      '--notes', notes,
    ], { cwd, encoding: 'utf8', timeout: 15000 });

    const m = out.match(/Intake #(\d+) recorded/);
    if (m) {
      map[taskId] = Number(m[1]);
      saveIntakeMap(map);
      return map[taskId];
    }
  } catch (err) {
    process.stderr.write(`[sync-harness-trace] intake for ${taskId}: ${err.message}\n`);
  }
  return null;
}

function splitList(raw) {
  if (!raw || /^none$/i.test(raw)) return [];
  return raw.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
}

function syncSection(taskId, taskContent, section) {
  const hash = crypto.createHash('sha256').update(section.body).digest('hex').slice(0, 16);
  const stateKey = `${taskId}:${section.date}:${hash}`;
  const state = loadState();
  if (state[stateKey]) return false;

  const summary = field(section.body, 'Done') || field(section.body, 'Summary');
  if (!summary || summary.length < 10) return false;

  const outcome = (field(section.body, 'Outcome') || 'completed').toLowerCase();
  const agent = field(section.body, 'Agent') || 'unknown';
  const storyId = field(section.body, 'Story ID') || taskField(taskContent, 'Story ID');
  const storyHeader = taskContent.match(/\*\*Story ID:\*\*\s*(\S+)/);
  const story = storyId || (storyHeader ? storyHeader[1] : '');
  const filesChanged = splitList(field(section.body, 'Files changed') || field(section.body, 'Files'));
  const errors = field(section.body, 'Errors') || 'none';
  const friction = field(section.body, 'Friction') || 'none';
  const decisions = field(section.body, 'Decisions');
  const tokensMatch = section.body.match(/\*\*Tokens:\*\*\s*(\d+)/);
  const tokens = tokensMatch ? parseInt(tokensMatch[1]) : null;

  // Structured action/file evidence for standard-tier traces.
  // Prefer explicit After-Work fields; fall back to derivable signals so the
  // trace still reaches `standard` when an agent omits them.
  let actions = splitList(field(section.body, 'Actions') || field(section.body, 'Actions taken'));
  if (!actions.length && summary) actions = [summary];

  let filesRead = splitList(field(section.body, 'Files read') || field(section.body, 'Read'));
  if (!filesRead.length && filesChanged.length) {
    // Editing a file implies it was read first (read-before-edit convention).
    filesRead = filesChanged.slice();
  }

  if (!fs.existsSync(cliPath)) return false;

  const intakeId = resolveIntakeId(taskId, taskContent);

  const args = [
    'trace',
    '--summary', summary,
    '--agent', agent,
    '--outcome', outcome,
    '--errors', errors,
    '--friction', friction,
  ];
  if (intakeId) {
    args.push('--intake', String(intakeId));
  }
  if (story && story !== 'optional' && !story.includes('(')) {
    args.push('--story', story.replace(/[()]/g, ''));
  }
  if (actions.length) {
    args.push('--actions', actions.join(','));
  }
  if (filesRead.length) {
    args.push('--read', filesRead.join(','));
  }
  if (filesChanged.length) {
    args.push('--changed', filesChanged.join(','));
  }
  if (decisions) {
    args.push('--decisions', decisions);
  }
  if (Number.isFinite(tokens)) {
    args.push('--tokens', String(tokens));
  }
  args.push('--notes', `task:${taskId} date:${section.date}`);

  try {
    execFileSync(cliPath, args, { cwd, stdio: 'pipe', timeout: 15000 });
    state[stateKey] = new Date().toISOString();
    saveState(state);
    return true;
  } catch (err) {
    process.stderr.write(`[sync-harness-trace] ${taskId}: ${err.message}\n`);
    return false;
  }
}

try {
  if (!fs.existsSync(tasksDir) || !fs.existsSync(cliPath)) {
    process.exit(0);
  }

  let synced = 0;
  for (const file of fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'))) {
    const content = readFileSafe(path.join(tasksDir, file));
    if (!content || !content.includes('### After-Work')) continue;
    const taskId = file.replace(/\.md$/, '');
    for (const section of parseAfterWorkSections(content)) {
      if (syncSection(taskId, content, section)) synced++;
    }
  }
  if (synced > 0) {
    process.stderr.write(`[sync-harness-trace] Synced ${synced} trace(s) to harness.db\n`);
  }
} catch (err) {
  process.stderr.write(`[sync-harness-trace] Error: ${err.message}\n`);
}
process.exit(0);
