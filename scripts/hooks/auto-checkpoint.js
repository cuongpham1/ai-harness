#!/usr/bin/env node
'use strict';

/**
 * Stop Hook — auto-checkpoint khi Claude dừng.
 *
 * Ghi kg/runtime/checkpoint.md với:
 *   - Git state (branch, commit, staged, unstaged, stashes)
 *   - Task đang làm từ in-progress.md
 *   - Context cuối (last user message từ transcript)
 *
 * /resume sẽ đọc checkpoint này thay vì latest.md để resume chính xác hơn.
 *
 * Always exits 0 — không bao giờ block session.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { writeAtomic } = require('../utils/atomic-write');
const { writeDual, readWithFallback } = require('../utils/kg-paths');

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; }
}

function ensureDir(dirPath) {
  try { fs.mkdirSync(dirPath, { recursive: true }); } catch { /* ignore */ }
}

function run(cmd) {
  try { return execSync(cmd, { cwd, encoding: 'utf8' }).trim(); } catch { return ''; }
}

function getTimestamp() {
  return new Date().toISOString();
}

function extractCommitMsg(cmd) {
  const heredocMatch = cmd.match(/cat\s+<<['"]?EOF['"]?\s*\n([\s\S]+?)\n\s*EOF/);
  if (heredocMatch) return heredocMatch[1].trim().split('\n')[0].trim();
  const mMatch = cmd.match(/-m\s+["']([\s\S]+?)["']/);
  if (mMatch) return mMatch[1].trim().split('\n')[0].trim();
  return null;
}

function getTranscriptData(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  const content = readFileSafe(transcriptPath);
  if (!content) return null;

  let lastMsg = null;
  const gitCommits = [];

  for (const line of content.split('\n').filter(Boolean)) {
    try {
      const entry = JSON.parse(line);
      const role = entry.role || entry.message?.role;

      if (role === 'user') {
        const rawContent = entry.message?.content ?? entry.content;
        const text = typeof rawContent === 'string'
          ? rawContent
          : Array.isArray(rawContent)
            ? rawContent.map(c => c?.text || '').join(' ')
            : '';
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (cleaned && cleaned.length > 5 && !cleaned.startsWith('<')) {
          lastMsg = cleaned.slice(0, 300);
        }
      }

      if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_use' && block.name === 'Bash') {
            const cmd = block.input?.command || '';
            if (/git\s+commit/.test(cmd)) {
              const msg = extractCommitMsg(cmd);
              if (msg && !gitCommits.includes(msg)) gitCommits.push(msg);
            }
          }
        }
      }
    } catch { /* skip unparseable lines */ }
  }
  return { lastMsg, gitCommits };
}

function getActiveTask() {
  const content = readWithFallback('in-progress.md');
  if (!content) return null;

  const match = content.match(/^## (.+)/m);
  if (!match) return null;

  const name = match[1].trim();
  const progressMatch = content.match(/\*\*Progress:\*\*\s*(\S+)/);
  const progress = progressMatch ? progressMatch[1] : '?%';
  const currentlyMatch = content.match(/\*\*Currently:\*\*\s*(.+)/);
  const currently = currentlyMatch ? currentlyMatch[1].trim() : null;

  return { name, progress, currently };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const MAX_STDIN = 512 * 1024;
let stdinData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (stdinData.length < MAX_STDIN) stdinData += chunk.substring(0, MAX_STDIN - stdinData.length);
});
process.stdin.on('end', () => {
  // Parse input with fallback to defaults (Phase 0B: always write checkpoint)
  let transcriptPath = null;
  try {
    const input = stdinData.trim() ? JSON.parse(stdinData) : {};
    transcriptPath = input.transcript_path || null;
  } catch (err) {
    process.stderr.write(`[AutoCheckpoint] Invalid stdin JSON: ${err.message}\n`);
  }

  try {
    // Git state
    const branch = run('git branch --show-current') || 'unknown';
    const commitHash = run('git rev-parse --short HEAD') || 'unknown';
    const commitMsg = run('git log -1 --format=%s') || '';
    const gitStatus = run('git status --short');
    const stashList = run('git stash list');

    const statusLines = gitStatus ? gitStatus.split('\n').filter(Boolean) : [];
    const staged = statusLines.filter(l => l[0] !== ' ' && l[0] !== '?').map(l => `  ${l}`);
    const unstaged = statusLines.filter(l => l[0] === ' ' || l[0] === '?').map(l => `  ${l}`);

    // Task + context
    const task = getActiveTask();
    const transcriptData = transcriptPath ? getTranscriptData(transcriptPath) : null;
    const lastMsg = transcriptData?.lastMsg ?? null;
    const gitCommits = transcriptData?.gitCommits ?? [];

    const lines = [
      '# Checkpoint',
      '',
      `**Saved:** ${getTimestamp()}`,
      `**Branch:** ${branch}`,
      `**Commit:** ${commitHash} — ${commitMsg}`,
      '',
      '## Git State',
      '',
      '**Staged:**',
      staged.length > 0 ? staged.join('\n') : 'none',
      '',
      '**Unstaged:**',
      unstaged.length > 0 ? unstaged.join('\n') : 'none',
      '',
      '**Stashes:**',
      stashList || 'none',
      '',
      '## Đang làm',
      '',
      `**Task:** ${task ? task.name : '(chưa có task rõ ràng)'}`,
      `**Progress:** ${task ? task.progress : '?%'}`,
    ];

    if (task?.currently) lines.push(`**Currently:** ${task.currently}`);

    if (gitCommits.length > 0) {
      lines.push('', '## Commits trong session', '');
      gitCommits.forEach(c => lines.push(`- ${c}`));
    }

    lines.push(
      '',
      '## Next step',
      '',
      lastMsg
        ? `> Context cuối: ${lastMsg}`
        : '> (chạy /handoff hoặc /checkpoint để ghi next step cụ thể)',
      '',
      '---',
      '> Auto-generated bởi auto-checkpoint.js khi Stop.',
      '> Chạy /checkpoint để override với next step cụ thể hơn.',
    );

    const output = lines.join('\n');
    // Single-write to kg/runtime only (Phase 2B)
    writeDual('checkpoint.md', output, writeAtomic);
  } catch (err) {
    process.stderr.write(`[AutoCheckpoint] Failed to write checkpoint: ${err.message}\n`);
  }

  process.exit(0);
});
