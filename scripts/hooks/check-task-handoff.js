#!/usr/bin/env node
'use strict';

/**
 * Stop hook — block session end if in_progress task has no After-Work note.
 * Checks CLAUDE_STOP_HOOK_ACTIVE to prevent infinite loops.
 * Exit 2 to block. Exit 0 to allow.
 */

const fs = require('fs');
const path = require('path');

// Prevent infinite loop (Claude Code sets this env var in Stop hooks)
if (process.env.CLAUDE_STOP_HOOK_ACTIVE === '1') {
  process.exit(0);
}

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
const tasksDir = path.join(cwd, '.project-manager', 'tasks');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; }
}

try {
  if (!fs.existsSync(tasksDir)) { process.exit(0); }

  const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md')).sort();
  const missing = [];

  for (const file of files) {
    const content = readFileSafe(path.join(tasksDir, file));
    if (!content) continue;

    const statusMatch = content.match(/\*\*Status:\*\*\s*(\S+)/);
    if (statusMatch?.[1]?.toLowerCase() !== 'in_progress') continue;

    if (!content.includes('### After-Work')) {
      const titleMatch = content.match(/^# Task:\s*(.+)$/m);
      missing.push({ id: file.replace('.md', ''), title: titleMatch?.[1] || file });
    }
  }

  if (missing.length > 0) {
    const list = missing.map(t => `  - ${t.id}: ${t.title}`).join('\n');
    process.stderr.write(
      `📋 [HANDOFF REQUIRED] Session không thể kết thúc.\n\n` +
      `Task đang in_progress chưa có After-Work note:\n${list}\n\n` +
      `Vui lòng append section sau vào mỗi task file trước khi kết thúc:\n\n` +
      `  ### After-Work — ${new Date().toISOString().slice(0, 10)}\n` +
      `  **Agent:** <role>\n` +
      `  **Done:** <tóm tắt>\n` +
      `  **Files changed:** <list>\n` +
      `  **Risks/Blockers:** none\n`
    );
    process.exit(2);
    return;
  }
} catch (err) {
  process.stderr.write(`[check-task-handoff] Error: ${err.message}\n`);
}
process.exit(0);
