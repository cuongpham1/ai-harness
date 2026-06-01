#!/usr/bin/env node
/**
 * Stop hook — sync task Story ID + Status to harness-cli story records.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import {
  projectRoot,
  tasksDir,
  readFileSafe,
  taskField,
  normalizeLane,
  normalizeStoryId,
  listTaskFiles,
  isProofVerifyReport,
} from './lib-harness-task.mjs';

const root = projectRoot();
const stateFile = path.join(root, 'kg', 'runtime', 'story-sync-state.json');
const verifyReportFile = path.join(root, 'kg', 'runtime', 'verify-last.json');
const cliPath = path.join(root, 'scripts', 'bin', 'harness-cli');

function loadState() {
  try {
    return JSON.parse(readFileSafe(stateFile) || '{}');
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function readVerifyReport() {
  try {
    return JSON.parse(readFileSafe(verifyReportFile) || '{}');
  } catch {
    return {};
  }
}

/** Promote to implemented only when verify-last.json is a proof pass for this task. */
function mapTaskStatus(raw, taskId, content) {
  const s = (raw || '').toLowerCase().replace(/\s+/g, '_');
  if (s === 'done' || s === 'completed') {
    const report = readVerifyReport();
    if (isProofVerifyReport(report, taskId, content)) return 'implemented';
    return 'in_progress';
  }
  if (s === 'in_progress') return 'in_progress';
  if (s === 'blocked' || s === 'cancelled') return s;
  return 'planned';
}

function syncTask(taskId, content) {
  const storyId = normalizeStoryId(taskField(content, 'Story ID'));
  if (!storyId) return false;

  const status = mapTaskStatus(taskField(content, 'Status'), taskId, content);
  const lane = normalizeLane(taskField(content, 'Lane'));
  const titleMatch = content.match(/^# Task:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : taskId;
  const hash = crypto
    .createHash('sha256')
    .update(`${storyId}:${status}:${lane}:${title}`)
    .digest('hex')
    .slice(0, 16);
  const stateKey = `${taskId}:${hash}`;
  const state = loadState();
  if (state[stateKey]) return false;

  const args = [
    'story',
    'update',
    '--id',
    storyId,
    '--status',
    status,
    '--evidence',
    `task:${taskId} lane:${lane} synced`,
  ];

  try {
    execFileSync(cliPath, args, { cwd: root, stdio: 'pipe', timeout: 15000 });
    state[stateKey] = new Date().toISOString();
    saveState(state);
    return true;
  } catch (err) {
    if (!/not found/i.test(String(err.stderr || err.message))) {
      process.stderr.write(`[sync-harness-story] ${taskId}: ${err.message}\n`);
      return false;
    }
  }

  try {
    execFileSync(
      cliPath,
      [
        'story',
        'add',
        '--id',
        storyId,
        '--title',
        title.slice(0, 200),
        '--lane',
        lane,
        '--notes',
        `task:${taskId}`,
      ],
      { cwd: root, stdio: 'pipe', timeout: 15000 },
    );
    execFileSync(cliPath, args, { cwd: root, stdio: 'pipe', timeout: 15000 });
    state[stateKey] = new Date().toISOString();
    saveState(state);
    return true;
  } catch (err) {
    process.stderr.write(`[sync-harness-story] ${taskId}: ${err.message}\n`);
    return false;
  }
}

try {
  if (!fs.existsSync(tasksDir(root)) || !fs.existsSync(cliPath)) {
    process.exit(0);
  }

  let synced = 0;
  for (const f of listTaskFiles(root)) {
    const content = readFileSafe(f.path);
    if (!content) continue;
    if (syncTask(f.taskId, content)) synced++;
  }
  if (synced > 0) {
    process.stderr.write(`[sync-harness-story] Synced ${synced} story record(s)\n`);
  }
} catch (err) {
  process.stderr.write(`[sync-harness-story] Error: ${err.message}\n`);
}
process.exit(0);
