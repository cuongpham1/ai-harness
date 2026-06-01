#!/usr/bin/env node
'use strict';

/**
 * PostToolUse(Write) hook — auto-update .project-manager/README.md
 * when task or issue files are created/modified.
 * Always exits 0 — never blocks.
 */

const fs = require('fs');
const path = require('path');

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
const PM_DIR = path.join(cwd, '.project-manager');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; }
}

function buildActiveTasksSection(pmDir) {
  const tasksDir = path.join(pmDir, 'tasks');
  if (!fs.existsSync(tasksDir)) return null;

  const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md')).sort();
  const active = [], done = [];

  for (const file of files) {
    const content = readFileSafe(path.join(tasksDir, file));
    if (!content) continue;
    const titleMatch = content.match(/^# Task:\s*(.+)$/m);
    const statusMatch = content.match(/\*\*Status:\*\*\s*(\S+)/);
    const priorityMatch = content.match(/\*\*Priority:\*\*\s*(\S+)/);
    const status = statusMatch?.[1]?.toLowerCase() || 'todo';
    const entry = {
      id: file.replace('.md', ''),
      title: titleMatch?.[1] || file,
      status,
      priority: priorityMatch?.[1] || '-'
    };
    if (status === 'done') done.push(entry);
    else active.push(entry);
  }

  const statusIcon = s => ({ in_progress: '🔄', blocked: '🚫', todo: '⬜' }[s] || '⬜');

  let section = '## Active Tasks\n\n';
  if (active.length === 0) {
    section += '_(Không có task nào đang active)_\n';
  } else {
    section += '| ID | Title | Status | Priority |\n';
    section += '|----|-------|--------|----------|\n';
    active.forEach(t => {
      section += `| [${t.id}](tasks/${t.id}.md) | ${t.title} | ${statusIcon(t.status)} ${t.status} | ${t.priority} |\n`;
    });
  }

  if (done.length > 0) {
    section += '\n## Completed Tasks\n\n';
    done.forEach(t => {
      section += `- [${t.id}](tasks/${t.id}.md): ${t.title}\n`;
    });
  }

  return { section, activeCount: active.length, doneCount: done.length };
}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input);
    const filePath = payload.tool_input?.file_path || '';
    const relPath = path.relative(cwd, path.resolve(cwd, filePath));

    // Only trigger for .project-manager/tasks/ or .project-manager/issues/
    if (!relPath.match(/^\.project-manager\/(tasks|issues)\/[^/]+\.md$/)) {
      process.exit(0);
      return;
    }

    const readmePath = path.join(PM_DIR, 'README.md');
    const result = buildActiveTasksSection(PM_DIR);
    if (!result) { process.exit(0); return; }

    let readme = readFileSafe(readmePath) || '';

    // Replace Active Tasks + Completed Tasks sections
    const sectionStart = readme.indexOf('\n## Active Tasks');
    if (sectionStart !== -1) {
      // Find next top-level section that isn't Active or Completed
      const afterSection = readme.slice(sectionStart + 1);
      const nextSection = afterSection.search(/\n## (?!Active Tasks|Completed Tasks)/);
      if (nextSection !== -1) {
        readme = readme.slice(0, sectionStart + 1) + result.section + readme.slice(sectionStart + 1 + nextSection + 1);
      } else {
        readme = readme.slice(0, sectionStart + 1) + result.section;
      }
    } else {
      readme = readme + '\n\n' + result.section;
    }

    fs.writeFileSync(readmePath, readme.trimEnd() + '\n');
    process.stderr.write(`[update-pm-readme] README.md updated — ${result.activeCount} active, ${result.doneCount} done\n`);
  } catch (err) {
    process.stderr.write(`[update-pm-readme] Error: ${err.message}\n`);
  }
  process.exit(0);
});
