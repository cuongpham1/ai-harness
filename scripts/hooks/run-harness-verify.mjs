#!/usr/bin/env node
/**
 * Stop hook — H4 lane-aware verification after trace score.
 * Blocks (exit 2) when --block and verify-story fails on completed outcomes.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import {
  projectRoot,
  readFileSafe,
  latestAfterWork,
  pickActiveTask,
  afterWorkField,
  writeVerifyReport,
} from './lib-harness-task.mjs';

const root = projectRoot();
const script = path.join(root, 'scripts', 'verify-story.sh');
const reportFile = path.join(root, 'kg', 'runtime', 'verify-last.json');
const stateFile = path.join(root, 'kg', 'runtime', 'verify-sync-state.json');

if (!fs.existsSync(script)) {
  process.exit(0);
}

const active = pickActiveTask(root);
const latest = active?.content ? latestAfterWork(active.content) : null;
const outcome = latest ? afterWorkField(latest.body, 'Outcome').toLowerCase() : '';

// Run stack verify only when After-Work explicitly claims completion
if (outcome !== 'completed') {
  if (active) {
    writeVerifyReport(reportFile, {
      ok: false,
      proof: false,
      stale: true,
      task: active.taskId,
      reason: `outcome_${outcome || 'missing'}`,
      at: new Date().toISOString(),
    });
  }
  process.exit(0);
}

function loadVerifyState() {
  try {
    return JSON.parse(readFileSafe(stateFile) || '{}');
  } catch {
    return {};
  }
}

function saveVerifyState(state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

const afterWorkHash =
  active && latest
    ? crypto.createHash('sha256').update(latest.body).digest('hex').slice(0, 16)
    : null;

if (active && afterWorkHash) {
  const stateKey = `${active.taskId}:${afterWorkHash}`;
  const state = loadVerifyState();
  if (state[stateKey]) {
    process.exit(0);
  }
}

const block = process.env.HARNESS_VERIFY_BLOCK !== '0';

try {
  const args = [script];
  if (block) args.push('--block');
  execFileSync('bash', args, { cwd: root, stdio: 'pipe', timeout: 600000, encoding: 'utf8' });
  if (active && afterWorkHash) {
    const state = loadVerifyState();
    state[`${active.taskId}:${afterWorkHash}`] = new Date().toISOString();
    saveVerifyState(state);
  }
} catch (err) {
  const msg = (err.stdout || '') + (err.stderr || '') || err.message;
  process.stderr.write(`[run-harness-verify] ${msg.trim() || 'verification failed'}\n`);
  if (fs.existsSync(reportFile)) {
    try {
      const report = JSON.parse(readFileSafe(reportFile) || '{}');
      if (!report.ok) {
        process.stderr.write('[run-harness-verify] See kg/runtime/verify-last.json\n');
      }
    } catch { /* ignore */ }
  }
  if (block && (err.status === 2 || err.status === 1)) {
    process.exit(2);
  }
}
process.exit(0);
