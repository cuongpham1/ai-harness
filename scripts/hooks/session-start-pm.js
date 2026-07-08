#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook — inject .project-manager state into context.
 * Reads README.md and in-progress task files, outputs additionalContext.
 * Always exits 0 — never blocks session.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { initSession } = require('../utils/session-touched-tasks');

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
const PM_DIR = path.join(cwd, '.project-manager');
const cliPath = path.join(cwd, 'scripts', 'bin', 'harness-cli');
const PIPELINE_STATE = path.join(cwd, 'kg', 'runtime', 'pipeline-state.json');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; }
}

/**
 * Read pipeline-state.json (backlog-27). Returns tasks with an incomplete
 * pipeline so the session can resume from the next stage instead of restarting.
 */
function getPipelineResumes() {
  let state;
  try { state = JSON.parse(fs.readFileSync(PIPELINE_STATE, 'utf8')); } catch { return []; }
  if (!state || typeof state.tasks !== 'object') return [];
  const resumes = [];
  for (const [id, entry] of Object.entries(state.tasks)) {
    if (entry && !entry.done && entry.nextStage) {
      resumes.push({ id, nextStage: entry.nextStage, completed: entry.completed || [] });
    }
  }
  return resumes;
}

function getTasksByStatus() {
  const tasksDir = path.join(PM_DIR, 'tasks');
  if (!fs.existsSync(tasksDir)) return { inProgress: [], todo: [], blocked: [], discipline: [] };

  const inProgress = [], todo = [], blocked = [];
  const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md')).sort();

  const discipline = [];

  for (const file of files) {
    const content = readFileSafe(path.join(tasksDir, file));
    if (!content) continue;
    const statusMatch = content.match(/\*\*Status:\*\*\s*(\S+)/);
    const titleMatch = content.match(/^# Task:\s*(.+)$/m);
    const status = statusMatch?.[1]?.toLowerCase() || 'todo';
    const entry = { id: file.replace('.md', ''), title: titleMatch?.[1] || file };

    const blocks = content.match(/### After-Work — [^\n]+\n([\s\S]*?)(?=### After-Work —|$)/g);
    if (blocks && blocks.length) {
      const last = blocks[blocks.length - 1];
      const outcome = (last.match(/\*\*Outcome:\*\*\s*(\S+)/i) || [])[1]?.toLowerCase();
      if (outcome === 'completed' && status !== 'done' && status !== 'completed') {
        discipline.push(entry.id);
      }
    }

    if (status === 'in_progress') inProgress.push(entry);
    else if (status === 'blocked') blocked.push(entry);
    else if (status === 'todo') todo.push(entry);
  }
  return { inProgress, todo, blocked, discipline };
}

try {
  const pmExists = fs.existsSync(PM_DIR);
  if (!pmExists) { process.exit(0); }

  try { initSession(); } catch { /* non-fatal */ }

  const { inProgress, todo, blocked, discipline } = getTasksByStatus();
  const parts = [];

  parts.push('## .project-manager State');

  if (inProgress.length > 0) {
    parts.push('');
    parts.push('### 🔄 In Progress');
    inProgress.forEach(t => parts.push(`- **${t.id}**: ${t.title}  →  \`.project-manager/tasks/${t.id}.md\``));
    parts.push('');
    parts.push('> Read task file for AC, scope, fixer guidance. Token tip: `docs/TOKEN_EFFICIENCY.md`');
  }

  const resumes = getPipelineResumes();
  if (resumes.length > 0) {
    parts.push('');
    parts.push('### ▶ Pipeline resume (backlog-27)');
    resumes.forEach(r => {
      const done = r.completed.length ? r.completed.join(' → ') : 'none';
      parts.push(`- **${r.id}**: done [${done}] → resume at \`@${r.nextStage}\``);
    });
    parts.push('> Pipeline crashed/interrupted mid-flight. Resume from `nextStage`; do not restart at coder.');
  }

  if (blocked.length > 0) {
    parts.push('');
    parts.push('### 🚫 Blocked');
    blocked.forEach(t => parts.push(`- **${t.id}**: ${t.title}`));
  }

  // Omit todo when in_progress exists — saves session tokens
  if (inProgress.length === 0 && todo.length > 0) {
    parts.push('');
    parts.push('### ⬜ Todo');
    todo.slice(0, 3).forEach(t => parts.push(`- **${t.id}**: ${t.title}`));
    if (todo.length > 3) parts.push(`  _(+${todo.length - 3} more — \`.project-manager/README.md\`)_`);
  }

  if (inProgress.length === 0 && todo.length === 0 && blocked.length === 0) {
    parts.push('');
    parts.push('Không có task nào. Xem `.project-manager/README.md` để bắt đầu.');
  }

  if (discipline.length > 0) {
    parts.push('');
    parts.push('### ⚠ Task close discipline');
    parts.push(`Tasks with \`Outcome: completed\` but Status not \`done\`: **${discipline.join(', ')}**.`);
    parts.push('Run `bash scripts/verify-story.sh --task <id>`; on pass set `Status: done` and tick AC.');
  }

  // Show open backlog count
  try {
    if (fs.existsSync(cliPath)) {
      const backlogRaw = execFileSync(cliPath, ['query', 'backlog'], {
        cwd, encoding: 'utf8', timeout: 8000,
      });
      const openItems = backlogRaw.trim().split('\n')
        .filter(l => l.trim() && !l.startsWith('id') && !l.startsWith('--'));
      if (openItems.length > 0) {
        parts.push('');
        parts.push(`### Backlog: ${openItems.length} open item(s)`);
        parts.push('Run: `scripts/bin/harness-cli query backlog`');
      }
    }
  } catch { /* ignore */ }

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
