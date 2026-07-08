#!/usr/bin/env node
'use strict';

/**
 * PostToolUse hook — auto-update .project-manager/README.md
 * when task or issue files are created/modified (Write or Edit).
 * CLI: node update-pm-readme.js --refresh-all
 * Always exits 0 — never blocks.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { touchTask } = require('../utils/session-touched-tasks');

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
const PM_DIR = path.join(cwd, '.project-manager');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; }
}

function resolveTaskOrIssueRelPath(payload) {
  const ti = payload?.tool_input || {};
  const raw = payload?.file_path
    || payload?.path
    || ti.file_path
    || ti.path
    || ti.filePath
    || '';
  if (!raw) return null;
  const rel = path.relative(cwd, path.resolve(cwd, raw)).replace(/\\/g, '/');
  if (!rel.match(/^\.project-manager\/(tasks|issues)\/[^/]+\.md$/)) return null;
  return rel;
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
    if (status === 'done' || status === 'completed') done.push(entry);
    else active.push(entry);
  }

  const statusIcon = s => ({ in_progress: '🔄', blocked: '🚫', todo: '⬜', wont_do: '⏸️' }[s] || '⬜');

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

function buildBacklogSection(root) {
  const cli = path.join(root, 'scripts', 'bin', 'harness-cli');
  let lines = [
    'Product issues: add bullets here.',
    '',
    'Harness/infra backlog (`harness.db`, benchmark/hooks — not product tasks):',
    '',
    '```bash',
    'scripts/bin/harness-cli query backlog',
    '```',
    '',
  ];
  if (!fs.existsSync(cli)) {
    lines.push('- [ ] (harness-cli not installed)');
    return lines.join('\n');
  }
  try {
    const out = execFileSync(cli, ['query', 'backlog'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000,
    });
    const rows = out
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^id\s+title/i.test(l) && !/^--/.test(l));
    const open = rows.filter((l) => !/\bimplemented\b/i.test(l)).slice(0, 6);
    if (open.length === 0) {
      lines.push(`- [ ] (${rows.length} harness backlog row(s) in DB — all implemented; see CLI for history)`);
    } else {
      open.forEach((r) => lines.push(`- [ ] \`${r}\` _(harness DB)_`));
    }
  } catch {
    lines.push('- [ ] (run `scripts/bin/harness-cli query backlog`)');
  }
  return lines.join('\n');
}

function sectionIndex(readme, heading) {
  if (readme.startsWith(`## ${heading}`)) return 0;
  const idx = readme.indexOf(`\n## ${heading}`);
  return idx === -1 ? -1 : idx + 1;
}

function replaceSection(readme, heading, body) {
  let out = readme;
  let firstStart = sectionIndex(out, heading);
  const marker = `## ${heading}`;
  while (sectionIndex(out, heading) !== -1) {
    const start = sectionIndex(out, heading);
    const searchFrom = start + marker.length;
    const next = out.slice(searchFrom).search(/\n## /);
    const end = next === -1 ? out.length : searchFrom + next;
    out = out.slice(0, start) + out.slice(end);
  }
  const block = `## ${heading}\n\n${body}\n`;
  if (firstStart === -1) return out.trimEnd() + '\n\n' + block;
  return out.slice(0, firstStart).trimEnd() + '\n\n' + block + out.slice(firstStart).trimStart();
}

/** Replace Active + Completed task blocks (dedupe) with a single fresh section. */
function replaceTaskSections(readme, taskSection) {
  const knownIdx = sectionIndex(readme, 'Known issues / backlog');
  const activeIdx = sectionIndex(readme, 'Active Tasks');

  if (activeIdx === -1) {
    if (knownIdx !== -1) {
      return readme.slice(0, knownIdx).trimEnd() + '\n\n' + taskSection.trimEnd() + '\n\n' + readme.slice(knownIdx);
    }
    return readme.trimEnd() + '\n\n' + taskSection;
  }

  const end = knownIdx !== -1 && knownIdx > activeIdx ? knownIdx : readme.length;
  const tail = knownIdx !== -1 && knownIdx > activeIdx ? readme.slice(knownIdx) : '';
  return readme.slice(0, activeIdx) + taskSection.trimEnd() + (tail ? '\n\n' + tail : '\n');
}

function refreshReadme(relPath) {
  if (relPath) {
    const taskId = path.basename(relPath, '.md');
    if (relPath.startsWith('.project-manager/tasks/')) {
      try { touchTask(taskId); } catch { /* non-fatal */ }
    }
  }

  const readmePath = path.join(PM_DIR, 'README.md');
  const result = buildActiveTasksSection(PM_DIR);
  if (!result) return null;

  let readme = readFileSafe(readmePath) || '';
  readme = replaceTaskSections(readme, result.section);
  readme = replaceSection(readme, 'Known issues / backlog', buildBacklogSection(cwd));
  fs.writeFileSync(readmePath, readme.trimEnd() + '\n');
  return result;
}

function refreshAllTaskFiles() {
  const tasksDir = path.join(PM_DIR, 'tasks');
  if (!fs.existsSync(tasksDir)) return refreshReadme(null);
  for (const file of fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'))) {
    try { touchTask(file.replace(/\.md$/, '')); } catch { /* ignore */ }
  }
  return refreshReadme(null);
}

function handleHookInput(rawInput) {
  const payload = JSON.parse(rawInput);
  const relPath = resolveTaskOrIssueRelPath(payload);
  if (!relPath) return;
  const result = refreshReadme(relPath);
  if (result) {
    process.stderr.write(
      `[update-pm-readme] README.md updated — ${result.activeCount} active, ${result.doneCount} done\n`
    );
  }
}

if (process.argv.includes('--refresh-all')) {
  try {
    const result = refreshAllTaskFiles();
    if (result) {
      process.stderr.write(
        `[update-pm-readme] README.md refreshed — ${result.activeCount} active, ${result.doneCount} done\n`
      );
    }
  } catch (err) {
    process.stderr.write(`[update-pm-readme] Error: ${err.message}\n`);
  }
  process.exit(0);
}

let input = '';
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  try {
    if (input.trim()) handleHookInput(input);
  } catch (err) {
    process.stderr.write(`[update-pm-readme] Error: ${err.message}\n`);
  }
  process.exit(0);
});

module.exports = { refreshReadme, refreshAllTaskFiles, resolveTaskOrIssueRelPath };
