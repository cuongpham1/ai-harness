#!/usr/bin/env node
'use strict';

/**
 * Track task IDs touched in the current agent session.
 * Used by check-task-handoff to scope After-Work gates to this session only.
 */

const fs = require('fs');
const path = require('path');

function projectRoot() {
  try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); }
}

function sessionId() {
  const raw = process.env.CLAUDE_SESSION_ID
    || process.env.CURSOR_SESSION_ID
    || String(process.pid);
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'default';
}

function statePath() {
  return path.join(projectRoot(), 'kg', 'runtime', 'session-touched-tasks.json');
}

function readState() {
  try {
    const data = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    if (data && typeof data === 'object') return data;
  } catch { /* fresh session */ }
  return { sessionId: sessionId(), touched: [], startedAt: new Date().toISOString() };
}

function writeState(state) {
  const dir = path.dirname(statePath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function initSession() {
  writeState({ sessionId: sessionId(), touched: [], startedAt: new Date().toISOString() });
}

function touchTask(taskId) {
  if (!taskId || typeof taskId !== 'string') return;
  const id = taskId.replace(/\.md$/, '').trim();
  if (!id) return;

  const state = readState();
  if (state.sessionId !== sessionId()) {
    state.sessionId = sessionId();
    state.touched = [];
    state.startedAt = new Date().toISOString();
  }
  if (!state.touched.includes(id)) state.touched.push(id);
  writeState(state);
}

function getTouchedTasks() {
  const state = readState();
  if (state.sessionId !== sessionId()) return [];
  return Array.isArray(state.touched) ? state.touched : [];
}

module.exports = { initSession, touchTask, getTouchedTasks, sessionId };
