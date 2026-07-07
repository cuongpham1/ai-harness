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

const FRICTION_TAGS = new Set([
  'docs-stale',
  'context-bloat',
  'hook-gap',
  'proof-gap',
  'dual-track',
  'tool-gap',
  'perm-gap',
  'memory-gap',
]);

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

function parseSectionFields(body) {
  const fields = {};
  const matches = [...body.matchAll(/\*\*([^*\n]{1,60}):\*\*\s*/g)];
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim().toLowerCase();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const value = body.slice(start, end).trim();
    if (!Object.prototype.hasOwnProperty.call(fields, name) || !fields[name]) {
      fields[name] = value;
    }
  }
  return fields;
}

function sectionField(fields, name, compact = true) {
  const value = fields[name.toLowerCase()] || '';
  if (!compact) return value;
  return value.replace(/\s+/g, ' ').trim();
}

function parseTokens(fields) {
  const raw = sectionField(fields, 'Tokens');
  if (!raw) return null;

  // Accept common token formats: "52000", "52,000", "52k", "1.2m".
  const lower = raw.toLowerCase();
  const m = lower.match(/(\d[\d,._\s]*)([km])?/);
  if (!m) return null;

  const digits = (m[1] || '').replace(/[^\d]/g, '');
  if (!digits) return null;

  let value = parseInt(digits, 10);
  if (!Number.isFinite(value) || value <= 0) return null;

  const suffix = m[2];
  if (suffix === 'k') value *= 1000;
  if (suffix === 'm') value *= 1000000;

  return Number.isFinite(value) && value > 0 ? value : null;
}

function laneNeedsTokenEstimate(lane) {
  return lane === 'normal' || lane === 'high_risk';
}

function normalizeSummary(raw) {
  const text = (raw || '').trim();
  if (!text) return '';
  const firstLine = text
    .split('\n')
    .map(line => line.trim())
    .find(Boolean) || '';
  return firstLine.replace(/^[-*]\s+/, '').replace(/\s+/g, ' ').trim();
}

function normalizeScalar(raw) {
  return (raw || '').replace(/^[-*]\s+/, '').replace(/\s+/g, ' ').trim();
}

function normalizeMultilineListText(raw) {
  const text = (raw || '').trim();
  if (!text) return '';
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .join(' | ')
    .replace(/\s+/g, ' ')
    .trim();
}

function notesExplainMissing(text, fieldName) {
  const lower = (text || '').toLowerCase();
  return lower.includes(fieldName)
    && (lower.includes('unavailable') || lower.includes('not available') || lower.includes('unknown'));
}

function normalizeFriction(rawFriction, lane, taskId, sectionDate) {
  const value = normalizeScalar(rawFriction);
  if (!value || /^none$/i.test(value)) {
    return { value: 'none', note: null };
  }

  if (!(lane === 'normal' || lane === 'high_risk')) {
    return { value, note: null };
  }

  const match = value.match(/^([a-z][a-z0-9-]*)\s*:/i);
  if (match && FRICTION_TAGS.has(match[1].toLowerCase())) {
    return { value, note: null };
  }

  process.stderr.write(
    `[sync-harness-trace] ${taskId}:${sectionDate} invalid friction tag for lane ${lane}; auto-tagging as tool-gap\n`,
  );
  return {
    value: `tool-gap: ${value}`,
    note: 'friction tag normalized: tool-gap',
  };
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

function splitList(raw, opts = {}) {
  const extractCodeToken = opts.extractCodeToken === true;
  if (!raw || /^none$/i.test(raw)) return [];
  return raw
    .split(/[,;\n]/)
    .map(s => s.trim())
    .map(s => s.replace(/^[-*]\s+/, '').trim())
    .map(s => {
      if (!extractCodeToken) return s;
      const m = s.match(/`([^`]+)`/);
      if (m) return m[1].trim();
      return s.replace(/\s+[—-]\s+.*$/, '').trim();
    })
    .filter(Boolean);
}

/**
 * Set of files git can corroborate as actually touched: uncommitted changes
 * (git status) plus files in the last few commits. Used to flag After-Work
 * "Files changed" entries that git never saw — a trace claiming work it didn't
 * do (proof-gap). Returns null if git is unavailable (skip the check).
 */
function gitTouchedFiles() {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8', timeout: 8000 });
    const recent = execFileSync('git', ['diff', '--name-only', 'HEAD~5..HEAD'], { cwd, encoding: 'utf8', timeout: 8000 });
    const set = new Set();
    for (const line of status.split('\n')) {
      const f = line.slice(3).trim();
      if (f) set.add(f);
    }
    for (const f of recent.split('\n')) {
      if (f.trim()) set.add(f.trim());
    }
    return set;
  } catch {
    return null; // not a git repo / shallow / git missing — skip honesty check
  }
}

function syncSection(taskId, taskContent, section) {
  const hash = crypto.createHash('sha256').update(section.body).digest('hex').slice(0, 16);
  const stateKey = `${taskId}:${section.date}:${hash}`;
  const state = loadState();
  if (state[stateKey]) return false;

  const fields = parseSectionFields(section.body);
  const lane = normalizeLane(taskField(taskContent, 'Lane'));

  const summary = normalizeSummary(
    sectionField(fields, 'Done', false) || sectionField(fields, 'Summary', false),
  );
  if (!summary || summary.length < 10) return false;

  const outcome = (normalizeScalar(sectionField(fields, 'Outcome')) || 'completed').toLowerCase();
  const agent = normalizeScalar(sectionField(fields, 'Agent')) || 'unknown';
  const storyId = sectionField(fields, 'Story ID') || taskField(taskContent, 'Story ID');
  const storyHeader = taskContent.match(/\*\*Story ID:\*\*\s*(\S+)/);
  const story = storyId || (storyHeader ? storyHeader[1] : '');
  const filesChanged = splitList(
    sectionField(fields, 'Files changed', false) || sectionField(fields, 'Files', false),
    { extractCodeToken: true },
  );
  const errors = normalizeScalar(sectionField(fields, 'Errors')) || 'none';
  const frictionRaw = sectionField(fields, 'Friction') || 'none';
  const frictionNormalized = normalizeFriction(frictionRaw, lane, taskId, section.date);
  let friction = frictionNormalized.value;
  const decisions = normalizeMultilineListText(sectionField(fields, 'Decisions', false));
  const tokens = parseTokens(fields);

  // Structured action/file evidence for standard-tier traces.
  // Prefer explicit After-Work fields; fall back to derivable signals so the
  // trace still reaches `standard` when an agent omits them.
  let actions = splitList(sectionField(fields, 'Actions', false) || sectionField(fields, 'Actions taken', false));
  if (!actions.length && summary) actions = [summary];

  let filesRead = splitList(
    sectionField(fields, 'Files read', false) || sectionField(fields, 'Read', false),
    { extractCodeToken: true },
  );
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

  // Honesty check: flag claimed changed files git can't corroborate.
  const noteParts = [`task:${taskId}`, `date:${section.date}`];

  if (laneNeedsTokenEstimate(lane) && !Number.isFinite(tokens)) {
    const notesField = sectionField(fields, 'Notes');
    const explainsMissing = notesExplainMissing(section.body, 'token') || notesExplainMissing(notesField, 'token');

    if (friction === 'none') {
      friction = 'tool-gap: token-estimate-missing';
      noteParts.push('friction inferred: tool-gap token-estimate-missing');
    }

    if (explainsMissing) {
      noteParts.push('token unavailable: noted in after-work');
    } else {
      process.stderr.write(
        `[sync-harness-trace] ${taskId}:${section.date} missing **Tokens:** for lane ${lane}; recording token unavailable in notes\n`,
      );
      noteParts.push('token unavailable: not provided in after-work');
    }
  }

  if (frictionNormalized.note) {
    noteParts.push(frictionNormalized.note);
  }

  if (filesChanged.length) {
    const touched = gitTouchedFiles();
    if (touched) {
      const unverified = filesChanged.filter(f => !touched.has(f));
      if (unverified.length) {
        process.stderr.write(
          `[sync-harness-trace] ${taskId}: ${unverified.length} claimed changed file(s) not seen by git: ${unverified.join(', ')}\n`,
        );
        noteParts.push(`unverified-files:${unverified.length}`);
      }
    }
  }
  args.push('--notes', noteParts.join(' '));

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
