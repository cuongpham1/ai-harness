#!/usr/bin/env node
'use strict';

/**
 * PostToolUse(Write) hook — auto-update .project-manager/README.md
 * when task or issue files are created/modified.
 * Always exits 0 — never blocks.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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
    if (status === 'done' || status === 'completed') done.push(entry);
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

function replaceSection(readme, heading, body) {
  const marker = `\n## ${heading}`;
  const start = readme.indexOf(marker);
  if (start === -1) return readme + `\n\n## ${heading}\n\n${body}\n`;
  const after = readme.slice(start + 1);
  const next = after.search(/\n## /);
  const end = next === -1 ? readme.length : start + 1 + next;
  return readme.slice(0, start + 1) + `\n## ${heading}\n\n${body}\n` + readme.slice(end);
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

    readme = replaceSection(readme, 'Known issues / backlog', buildBacklogSection(cwd));

    fs.writeFileSync(readmePath, readme.trimEnd() + '\n');
    process.stderr.write(`[update-pm-readme] README.md updated — ${result.activeCount} active, ${result.doneCount} done\n`);
  } catch (err) {
    process.stderr.write(`[update-pm-readme] Error: ${err.message}\n`);
  }
  process.exit(0);
});
