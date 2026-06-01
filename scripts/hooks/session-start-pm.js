#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook — inject .project-manager state into context.
 * Reads README.md and in-progress task files, outputs additionalContext.
 * Always exits 0 — never blocks session.
 */

const fs = require('fs');
const path = require('path');

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
const PM_DIR = path.join(cwd, '.project-manager');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; }
}

function getTasksByStatus() {
  const tasksDir = path.join(PM_DIR, 'tasks');
  if (!fs.existsSync(tasksDir)) return { inProgress: [], todo: [], blocked: [] };

  const inProgress = [], todo = [], blocked = [];
  const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md')).sort();

  for (const file of files) {
    const content = readFileSafe(path.join(tasksDir, file));
    if (!content) continue;
    const statusMatch = content.match(/\*\*Status:\*\*\s*(\S+)/);
    const titleMatch = content.match(/^# Task:\s*(.+)$/m);
    const status = statusMatch?.[1]?.toLowerCase() || 'todo';
    const entry = { id: file.replace('.md', ''), title: titleMatch?.[1] || file };

    if (status === 'in_progress') inProgress.push(entry);
    else if (status === 'blocked') blocked.push(entry);
    else if (status === 'todo') todo.push(entry);
  }
  return { inProgress, todo, blocked };
}

try {
  const pmExists = fs.existsSync(PM_DIR);
  if (!pmExists) { process.exit(0); }

  const { inProgress, todo, blocked } = getTasksByStatus();
  const parts = [];

  parts.push('## .project-manager State');

  if (inProgress.length > 0) {
    parts.push('');
    parts.push('### 🔄 In Progress');
    inProgress.forEach(t => parts.push(`- **${t.id}**: ${t.title}  →  \`.project-manager/tasks/${t.id}.md\``));
    parts.push('');
    parts.push('> Đọc file task để lấy AC items, scope, fixer guidance và notes trước khi bắt đầu.');
  }

  if (blocked.length > 0) {
    parts.push('');
    parts.push('### 🚫 Blocked');
    blocked.forEach(t => parts.push(`- **${t.id}**: ${t.title}`));
  }

  if (todo.length > 0) {
    parts.push('');
    parts.push('### ⬜ Todo');
    todo.slice(0, 5).forEach(t => parts.push(`- **${t.id}**: ${t.title}`));
    if (todo.length > 5) parts.push(`  _(+${todo.length - 5} more — xem \`.project-manager/README.md\`)_`);
  }

  if (inProgress.length === 0 && todo.length === 0 && blocked.length === 0) {
    parts.push('');
    parts.push('Không có task nào. Xem `.project-manager/README.md` để bắt đầu.');
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: parts.join('\n')
    }
  }));
} catch (err) {
  process.stderr.write(`[session-start-pm] Error: ${err.message}\n`);
}
process.exit(0);
