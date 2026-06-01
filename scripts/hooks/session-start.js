#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook — surface project memory vào context khi mở session mới.
 *
 * Đọc theo thứ tự ưu tiên:
 *   1. User role           → business hay developer?
 *   2. Bootstrap state     → có cần /bootstrap không?
 *   3. In-progress tasks   → đang làm gì?
 *   4. Latest session      → dừng ở đâu, next action là gì?
 *   5. Blockers            → có vấn đề gì chặn tiến độ?
 *   6. Learned patterns    → số patterns đã học
 *
 * Developer path: sync business worktree nếu có commit mới.
 * Designer path:  load design context vào session.
 *
 * Output: hookSpecificOutput.additionalContext (chuẩn ECC SessionStart)
 * Always exits 0 — không bao giờ block session.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { writeAtomic } = require('../utils/atomic-write');
const { readWithFallback, getKgPath, findExistingPath } = require('../utils/kg-paths');

const cwd = (() => { try { return require('fs').realpathSync(process.cwd()); } catch { return process.cwd(); } })();

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return null;
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

// ─── Role detection ─────────────────────────────────────────────────────────

function readUserRole() {
  const content = readFileSafe(path.join(cwd, '.project-info', 'user-role.md'));
  if (!content) return null;
  const match = content.match(/\*\*Role:\*\*\s*(\w+)/i);
  return match ? match[1].toLowerCase() : null;
}

// ─── Git helpers ─────────────────────────────────────────────────────────────

function execSafe(cmd) {
  try {
    return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 })
      .toString().trim();
  } catch {
    return null;
  }
}

// ─── Business worktree sync (developer path) ─────────────────────────────────

function syncDesignerWorktree() {
  // Fetch business branch
  execSafe('git fetch origin business --quiet 2>/dev/null');

  const remoteHead = execSafe('git rev-parse origin/business 2>/dev/null');
  if (!remoteHead) return { action: 'no-remote-branch' };

  const worktreePath = path.join(cwd, '.worktrees', 'business');

  if (!exists(worktreePath)) {
    // Tạo worktree mới
    const result = execSafe(`git worktree add "${worktreePath}" origin/business`);
    if (result !== null) {
      return { action: 'created', worktreePath };
    }
    return null;
  }

  // Worktree đã có — kiểm tra có commit mới không
  const worktreeHead = execSafe(`git -C "${worktreePath}" rev-parse HEAD`);
  if (!worktreeHead || worktreeHead === remoteHead) {
    return { action: 'uptodate', worktreePath };
  }

  // Đếm số commit mới trước khi pull
  const newLog = execSafe(`git -C "${worktreePath}" log HEAD..origin/business --oneline`);
  const newCount = newLog ? newLog.split('\n').filter(Boolean).length : 0;

  execSafe(`git -C "${worktreePath}" pull --ff-only`);
  return { action: 'updated', worktreePath, newCount };
}

// ─── Designer context + sync (business path) ─────────────────────────────────

function readDesignerBranch() {
  const content = readFileSafe(path.join(cwd, '.project-info', 'user-role.md'));
  if (!content) return null;
  const match = content.match(/\*\*Branch:\*\*\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function syncDesignerBranchForDesigner() {
  const currentBranch = execSafe('git rev-parse --abbrev-ref HEAD');
  // Nếu đang ở thẳng branch business thì không cần sync
  if (!currentBranch || currentBranch === 'business') return null;

  // Fetch business để xem có commit mới không
  execSafe('git fetch origin business --quiet');
  const remoteHead = execSafe('git rev-parse origin/business');
  if (!remoteHead) return null;

  // Tìm merge base giữa branch hiện tại và origin/business
  const mergeBase = execSafe(`git merge-base HEAD origin/business`);
  if (!mergeBase || mergeBase === remoteHead) return null; // đã up to date

  // Đếm commit mới trên business kể từ khi tách branch
  const newLog = execSafe(`git log ${mergeBase}..origin/business --oneline`);
  if (!newLog) return null;

  const commits = newLog.split('\n').filter(Boolean);
  if (commits.length === 0) return null;

  // Tóm tắt files thay đổi
  const diffStat = execSafe(`git diff --stat ${mergeBase}..origin/business`);
  const lastLine = diffStat ? diffStat.split('\n').filter(Boolean).pop() : null;

  return {
    count: commits.length,
    commits: commits.slice(0, 5), // tối đa 5 commits để không flood context
    diffSummary: lastLine,
    currentBranch,
  };
}

function readDesignContext() {
  const designMd = readFileSafe(path.join(cwd, '.project-info', 'conventions', 'design.md'));
  return { designMd };
}

// ─── Project state detection ───────────────────────────────────────────────

function detectProjectState() {
  const hasCode = ['src', 'app', 'lib', 'packages'].some(dir =>
    exists(path.join(cwd, dir))
  );
  const hasPackageJson = exists(path.join(cwd, 'package.json'));
  const hasAnyConfig = ['go.mod', 'pyproject.toml', 'Cargo.toml', 'pom.xml', 'build.gradle'].some(f =>
    exists(path.join(cwd, f))
  );

  const isBootstrapped = exists(path.join(cwd, '.project-info', 'meta.md')) ||
                          exists(path.join(cwd, '.project-info', 'user-role.md'));
  return {
    isEmpty: !hasCode && !hasPackageJson && !hasAnyConfig && !isBootstrapped,
    isBootstrapped,
    hasProjectManager: exists(findExistingPath('status.md')),
  };
}

function getProjectName() {
  const raw = readFileSafe(path.join(cwd, 'package.json'));
  if (raw) {
    try { return JSON.parse(raw).name || null; } catch { /* ignore */ }
  }
  return path.basename(cwd);
}

// ─── Memory readers ────────────────────────────────────────────────────────

function readInProgressTasks() {
  const content = readWithFallback('in-progress.md');
  if (!content) return null;

  // Lấy các task đang làm (dòng có ## heading hoặc - [ ] pattern)
  const tasks = [];
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('## ') && !line.includes('template') && !line.includes('Template')) {
      tasks.push(line.replace('## ', '').trim());
    }
  }
  return tasks.length > 0 ? tasks : null;
}

function readMemory() {
  const content = readWithFallback('memory.md');
  if (!content) return null;

  // Giới hạn 2500 chars — post-compact sẽ ngắn, pre-compact lấy phần cuối
  const MAX = 2500;
  if (content.length <= MAX) return content;

  // Lấy từ entry cuối cùng trong phạm vi MAX chars
  const tail = content.slice(-MAX);
  const firstEntry = tail.indexOf('\n## ');
  return firstEntry > 0 ? tail.slice(firstEntry + 1) : tail;
}

function readCheckpoint() {
  const content = readWithFallback('checkpoint.md');
  if (!content) return null;

  const branch = content.match(/\*\*Branch:\*\*\s*(.+)/)?.[1]?.trim();
  const commit = content.match(/\*\*Commit:\*\*\s*(.+)/)?.[1]?.trim();
  const task   = content.match(/\*\*Task:\*\*\s*(.+)/)?.[1]?.trim();
  const progress = content.match(/\*\*Progress:\*\*\s*(.+)/)?.[1]?.trim();
  const currently = content.match(/\*\*Currently:\*\*\s*(.+)/)?.[1]?.trim();

  const nextMatch = content.match(/## Next step\n+([\s\S]*?)(?=\n---|$)/);
  const nextStep = nextMatch ? nextMatch[1].trim() : null;

  if (!task && !nextStep) return null;
  return { branch, commit, task, progress, currently, nextStep };
}

function readBlockers() {
  const content = readWithFallback('blockers.md');
  if (!content) return null;

  // Tìm blockers chưa resolved (không có ~~strikethrough~~ hay [resolved])
  const lines = content.split('\n').filter(l =>
    l.startsWith('- ') &&
    !l.includes('~~') &&
    !l.toLowerCase().includes('[resolved]') &&
    !l.toLowerCase().includes('không có')
  );
  return lines.length > 0 ? lines.slice(0, 3) : null;
}

function detectUnorganizedFiles() {
  const output = execSafe('git status --porcelain');
  if (!output) return null;

  // Untracked files có prefix `??`
  const untracked = output
    .split('\n')
    .filter(line => line.startsWith('??'))
    .map(line => line.substring(3).trim());

  if (untracked.length === 0) return null;

  // System folders/files để exclude
  const excludePatterns = [
    /^backlog\//,
    /^\.claude\//,
    /^kg\/runtime\//,
    /^\.project-info\//,
    /^scripts\//,
    /^gstack\//,
    /^node_modules\//,
    /^\.git\//,
    /^\.worktrees\//,
    /^\.design-session\.pid$/,
    /^CLAUDE\.md$/,
    /^README\.md$/,
  ];

  const filtered = untracked.filter(file => {
    return !excludePatterns.some(pattern => pattern.test(file));
  });

  return filtered.length > 0 ? filtered : null;
}

// ─── Business update detection (developer path) ──────────────────────────────

function getLastSyncedBusinessCommit() {
  return readFileSafe(path.join(cwd, '.project-info', 'last-business-sync-commit'));
}

function saveLastSyncedBusinessCommit(hash) {
  const syncFile = path.join(cwd, '.project-info', 'last-business-sync-commit');
  try {
    writeAtomic(syncFile, hash);
  } catch (err) {
    process.stderr.write(`[SessionStart] Could not save business sync commit: ${err.message}\n`);
  }
}

function checkBusinessUpdates(worktreePath) {
  if (!exists(worktreePath)) return null;

  const currentHead = execSafe(`git -C "${worktreePath}" rev-parse HEAD`);
  if (!currentHead) return null;

  const lastSynced = getLastSyncedBusinessCommit();
  if (lastSynced === currentHead) return null; // nothing new

  // Get changed files since last sync
  let changedFiles;
  if (lastSynced) {
    // Check if lastSynced commit exists in worktree history
    const commitExists = execSafe(`git -C "${worktreePath}" cat-file -t ${lastSynced} 2>/dev/null`);
    if (commitExists === 'commit') {
      const diff = execSafe(`git -C "${worktreePath}" diff --name-only ${lastSynced}..HEAD`);
      changedFiles = diff ? diff.split('\n').filter(Boolean) : [];
    } else {
      // Commit not found (worktree was recreated) — treat as first time
      const ls = execSafe(`git -C "${worktreePath}" ls-files backlog/ .design-handoff/`);
      changedFiles = ls ? ls.split('\n').filter(Boolean) : [];
    }
  } else {
    // First time sync — list all tracked files in relevant dirs
    const ls = execSafe(`git -C "${worktreePath}" ls-files backlog/ .design-handoff/`);
    changedFiles = ls ? ls.split('\n').filter(Boolean) : [];
  }

  // Save new head regardless of whether there are relevant changes
  saveLastSyncedBusinessCommit(currentHead);

  if (changedFiles.length === 0) return null;

  // Categorize by directory
  const taskFiles = changedFiles.filter(f => f.startsWith('backlog/tasks/') && f.endsWith('.md'));
  const apiDocFiles = changedFiles.filter(f => f.startsWith('backlog/docs/api/') && f.endsWith('.md'));
  const otherDocFiles = changedFiles.filter(f =>
    f.startsWith('backlog/docs/') && !f.startsWith('backlog/docs/api/') && f.endsWith('.md')
  );
  const handoffFiles = changedFiles.filter(f => f.startsWith('.design-handoff/') && f.endsWith('.md'));

  if (!taskFiles.length && !apiDocFiles.length && !otherDocFiles.length && !handoffFiles.length) return null;

  const result = {};

  if (handoffFiles.length) {
    result.handoffs = handoffFiles.map(f => {
      const fullPath = path.join(worktreePath, f);
      const content = readFileSafe(fullPath);
      const titleMatch = content && content.match(/^# (.+)$/m);
      const pendingItems = content ? (content.match(/- \[ \]/g) || []).length : 0;
      return {
        file: f,
        title: titleMatch ? titleMatch[1] : path.basename(f, '.md'),
        pendingItems,
      };
    });
  }

  if (taskFiles.length) {
    result.tasks = taskFiles.map(f => {
      const fullPath = path.join(worktreePath, f);
      const content = readFileSafe(fullPath);
      const titleMatch = content && (content.match(/^# (.+)$/m) || content.match(/^## (.+)$/m));
      const statusMatch = content && content.match(/\*\*[Ss]tatus:\*\*\s*(.+)/);
      return {
        file: f,
        title: titleMatch ? titleMatch[1] : path.basename(f, '.md'),
        status: statusMatch ? statusMatch[1].trim() : null,
      };
    });
  }

  if (apiDocFiles.length) {
    result.apiDocs = apiDocFiles.map(f => {
      const fullPath = path.join(worktreePath, f);
      const content = readFileSafe(fullPath);
      const titleMatch = content && content.match(/^# (.+)$/m);
      const endpointCount = content ? (content.match(/^\| (GET|POST|PUT|DELETE|PATCH) \|/gm) || []).length : 0;
      const baseUrlMatch = content && content.match(/\*\*Base URL:\*\*\s*(.+)/);
      return {
        file: f,
        title: titleMatch ? titleMatch[1] : path.basename(f, '.md'),
        endpointCount,
        baseUrl: baseUrlMatch ? baseUrlMatch[1].trim() : null,
      };
    });
  }

  if (otherDocFiles.length) {
    result.docs = otherDocFiles.map(f => ({
      file: f,
      title: path.basename(f, '.md').replace(/-/g, ' '),
    }));
  }

  return result;
}

// ─── Drift Detection (developer path) ────────────────────────────────────────

const PATH_CLAIM_RE = /`([^`\n ]{3,})`/g;
const SRC_PREFIXES = ['src/', 'app/', 'lib/', 'packages/', 'components/', 'pages/', 'api/', 'server/', 'client/'];
const SRC_EXTS = /\.(ts|tsx|js|jsx|py|go|rs|java|kt|swift|vue|svelte)$/;
const NPM_RUN_RE = /`npm run ([\w:.-]+)`/g;

function extractPathClaims(content) {
  const results = [];
  let m;
  PATH_CLAIM_RE.lastIndex = 0;
  while ((m = PATH_CLAIM_RE.exec(content)) !== null) {
    const val = m[1];
    if (val.startsWith('http') || val.includes('{') || val.includes('[')) continue;
    if (SRC_PREFIXES.some(p => val.startsWith(p)) || SRC_EXTS.test(val)) {
      results.push(val);
    }
  }
  return results;
}

function checkDrift() {
  const projectInfoPath = path.join(cwd, '.project-info');
  if (!exists(projectInfoPath)) return null;

  const errors = [];
  const warnings = [];

  // ── Collect .project-info files (skip templates and sync state files)
  let infoFiles = [];
  try {
    infoFiles = fs.readdirSync(projectInfoPath)
      .filter(f => f.endsWith('.md') && !f.endsWith('_template.md') && f !== 'patterns.md')
      .map(f => path.join(projectInfoPath, f));

    const convDir = path.join(projectInfoPath, 'conventions');
    if (exists(convDir)) {
      infoFiles.push(...fs.readdirSync(convDir)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(convDir, f)));
    }
  } catch { /* ignore */ }

  // ── 1. Staleness check — commits since last doc update
  for (const filePath of infoFiles) {
    const relPath = path.relative(cwd, filePath);
    const lastCommit = execSafe(`git log -1 --format="%H" -- "${relPath}"`);
    if (!lastCommit) continue; // untracked

    const countStr = execSafe(`git rev-list --count ${lastCommit}..HEAD`);
    const count = parseInt(countStr || '0', 10);
    if (count >= 200) {
      errors.push(`${relPath} — ${count} commits chưa cập nhật`);
    } else if (count >= 50) {
      warnings.push(`${relPath} — ${count} commits chưa cập nhật`);
    }
  }

  // ── 2. Path check — file paths mentioned in docs that no longer exist
  for (const filePath of infoFiles) {
    const relPath = path.relative(cwd, filePath);
    const content = readFileSafe(filePath);
    if (!content) continue;

    for (const claimed of extractPathClaims(content)) {
      if (!exists(path.join(cwd, claimed))) {
        warnings.push(`${relPath}: \`${claimed}\` không còn tồn tại`);
      }
    }
  }

  // ── 3. Command check — npm run X in rule files that aren't in package.json
  const pkgRaw = readFileSafe(path.join(cwd, 'package.json'));
  if (pkgRaw) {
    let scripts = {};
    try { scripts = JSON.parse(pkgRaw).scripts || {}; } catch { /* ignore */ }

    const ruleFiles = [
      path.join(cwd, '.claude', 'rules', 'testing.md'),
    ];

    for (const ruleFile of ruleFiles) {
      const content = readFileSafe(ruleFile);
      if (!content) continue;
      const relPath = path.relative(cwd, ruleFile);

      let m;
      NPM_RUN_RE.lastIndex = 0;
      while ((m = NPM_RUN_RE.exec(content)) !== null) {
        const scriptName = m[1];
        // Skip placeholders
        if (scriptName.includes('[') || scriptName.includes('...')) continue;
        if (!scripts[scriptName]) {
          warnings.push(`${relPath}: \`npm run ${scriptName}\` không có trong package.json`);
        }
      }
    }
  }

  if (!errors.length && !warnings.length) return null;
  return { errors, warnings };
}

// ─── Gap Detection (developer path) ──────────────────────────────────────────

const CODE_EXTS = /\.(ts|tsx|js|jsx|py|go|rs|java|kt|swift|vue|svelte)$/;
const CODE_ROOTS = ['src/', 'app/', 'lib/', 'packages/'];

function checkGaps() {
  const architecturePath = path.join(cwd, '.project-info', 'architecture.md');
  if (!exists(architecturePath)) return null;

  // Get changed source files from last 30 commits
  const WINDOW = 30;
  const totalCommits = parseInt(execSafe('git rev-list --count HEAD') || '0', 10);
  if (totalCommits < 5) return null; // too new to gap-check

  const rawChanged = execSafe(`git diff --name-only HEAD~${Math.min(WINDOW, totalCommits - 1)}..HEAD`);
  if (!rawChanged) return null;

  const sourceFiles = rawChanged.split('\n').filter(f =>
    f &&
    CODE_EXTS.test(f) &&
    !f.includes('.test.') &&
    !f.includes('.spec.') &&
    !f.includes('__tests__') &&
    !f.includes('node_modules') &&
    CODE_ROOTS.some(r => f.startsWith(r))
  );

  if (sourceFiles.length === 0) return null;

  const warnings = [];

  // 1. Missing test files
  const missingTests = sourceFiles.filter(file => {
    const ext = path.extname(file);
    const base = file.slice(0, -ext.length);
    return ![
      `${base}.test${ext}`,
      `${base}.spec${ext}`,
      `${base}.test.${ext.slice(1)}`,
      `${base}.spec.${ext.slice(1)}`,
    ].some(tp => exists(path.join(cwd, tp)));
  });

  if (missingTests.length > 0) {
    const shown = missingTests.slice(0, 4);
    shown.forEach(f => warnings.push(`${f} — thiếu test file`));
    if (missingTests.length > 4) warnings.push(`... và ${missingTests.length - 4} file khác thiếu tests`);
  }

  // 2. New modules not in architecture.md
  const archContent = readFileSafe(architecturePath) || '';
  const newModules = new Set();
  for (const file of sourceFiles) {
    const parts = file.split('/');
    if (parts.length < 3) continue;
    const moduleName = parts[1]; // e.g., "payments" from "src/payments/service.ts"
    if (!archContent.includes(moduleName)) {
      newModules.add(`${parts[0]}/${moduleName}/`);
    }
  }
  newModules.forEach(m => warnings.push(`${m} — module mới, chưa có trong architecture.md`));

  return warnings.length > 0 ? { warnings } : null;
}

function readLearnedPatternsCount() {
  const content = readFileSafe(path.join(cwd, '.project-info', 'patterns.md'));
  if (!content) return 0;

  const matches = content.match(/^## /gm);
  return matches ? matches.length : 0;
}

function readStackInfo() {
  const meta = readFileSafe(path.join(cwd, '.project-info', 'meta.md'));
  if (!meta) return null;

  const stack = meta.match(/\*\*Stack:\*\*\s*(.+)/)?.[1]?.trim();
  const arch  = meta.match(/\*\*Architecture:\*\*\s*(.+)/)?.[1]?.trim();
  return { stack, arch };
}

// ─── Message builder ────────────────────────────────────────────────────────

function buildContext(state, role, worktreeResult) {
  const parts = [];
  const name = getProjectName();

  // ── Role badge
  if (role) {
    parts.push(`## Project: ${name} [${role.toUpperCase()}]`);
  } else {
    parts.push(`## Project: ${name}`);
  }

  // ── Case 1: Project rỗng
  if (state.isEmpty) {
    parts.push('');
    parts.push('Project chưa có code. Chạy `/bootstrap` để bắt đầu wizard.');
    parts.push('Claude sẽ hỏi vai trò (business/developer), tech stack, và mục tiêu.');
    return parts.join('\n');
  }

  // ── Case 2: Chưa bootstrap
  if (!state.isBootstrapped) {
    parts.push('');
    parts.push('Chưa bootstrap. Chạy `/bootstrap` để phân tích codebase và thiết lập role.');
    return parts.join('\n');
  }

  // ── Case 3: Đã bootstrap — surface memory đầy đủ

  // Stack info
  const stackInfo = readStackInfo();
  if (stackInfo?.stack) parts.push(`Stack: ${stackInfo.stack}`);
  if (stackInfo?.arch)  parts.push(`Architecture: ${stackInfo.arch}`);

  // Checkpoint — source of truth nếu có
  const checkpoint = readCheckpoint();
  if (checkpoint) {
    parts.push('');
    parts.push('### Checkpoint (auto-resume)');
    if (checkpoint.branch) parts.push(`Branch: ${checkpoint.branch}  Commit: ${checkpoint.commit || '?'}`);
    if (checkpoint.task)   parts.push(`Task: ${checkpoint.task}${checkpoint.progress ? ` — ${checkpoint.progress}` : ''}`);
    if (checkpoint.currently) parts.push(`Currently: ${checkpoint.currently}`);
    if (checkpoint.nextStep) {
      parts.push('');
      parts.push(`Next step: ${checkpoint.nextStep}`);
    }
  } else {
    // Fallback: In-progress tasks + memory
    const tasks = readInProgressTasks();
    if (tasks) {
      parts.push('');
      parts.push('### Đang làm');
      tasks.forEach(t => parts.push(`- ${t}`));
    }
  }

  // Session memory — luôn inject nếu có (cả khi có checkpoint)
  const memory = readMemory();
  if (memory) {
    parts.push('');
    parts.push('### Session Memory');
    parts.push(memory);
  }

  // Blockers — cần biết ngay nếu có
  const blockers = readBlockers();
  if (blockers) {
    parts.push('');
    parts.push('### Blockers');
    blockers.forEach(b => parts.push(b));
  }

  // Learned patterns count — context nhẹ
  const patternCount = readLearnedPatternsCount();
  if (patternCount > 0) {
    parts.push('');
    parts.push(`Learned patterns: ${patternCount} (xem .project-info/patterns.md)`);
  }

  // ── File Organizer (chỉ business role)
  if (role === 'business') {
    const unorganizedFiles = detectUnorganizedFiles();
    if (unorganizedFiles) {
      parts.push('');
      parts.push(`[PM FILE-ORGANIZER] Phát hiện ${unorganizedFiles.length} file chưa được tổ chức:`);
      unorganizedFiles.forEach(f => parts.push(`  - ${f}`));
    }
  }

  // ── Designer-specific context
  if (role === 'business') {
    const { designMd } = readDesignContext();
    if (designMd) {
      parts.push('');
      parts.push('### Design System');
      const headers = designMd.split('\n')
        .filter(l => l.startsWith('## '))
        .map(l => `- ${l.replace('## ', '')}`)
        .join('\n');
      parts.push(headers || '(xem .project-info/conventions/design.md)');
    }

    // Kiểm tra business branch có commit mới không
    const designerSync = syncDesignerBranchForDesigner();
    if (designerSync) {
      parts.push('');
      parts.push(`### Business branch có ${designerSync.count} commit mới`);
      designerSync.commits.forEach(c => parts.push(`  ${c}`));
      if (designerSync.diffSummary) parts.push(`  ${designerSync.diffSummary}`);
      parts.push('');
      parts.push('Bạn có muốn merge business branch vào branch hiện tại không?');
      parts.push(`  Có: \`git merge origin/business\``);
      parts.push(`  Không: tiếp tục làm việc trên \`${designerSync.currentBranch}\``);
    }

    parts.push('');
    parts.push('Dùng `/design [mô tả]` để build UI, `/design layout` hoặc `/design theme` để điều chỉnh.');
  }

  // ── Developer: business updates (push model)
  if (role === 'developer') {
    const worktreePath = path.join(cwd, '.worktrees', 'business');

    // Show worktree setup notice only when it's new (first time)
    if (worktreeResult && worktreeResult.action === 'no-remote-branch') {
      parts.push('');
      parts.push('### Branch `business` chưa tồn tại trên remote');
      parts.push('Branch này dùng để business members thiết kế UI và handoff cho developer.');
      parts.push('  Tạo: `git checkout -b business && git push -u origin business && git checkout -`');
    } else if (worktreeResult && worktreeResult.action === 'created') {
      parts.push('');
      parts.push('### Business worktree đã được tạo tại `.worktrees/business/`');
    }

    // Business update signal
    const updates = checkBusinessUpdates(worktreePath);
    if (updates) {
      parts.push('');
      parts.push('[BUSINESS UPDATE] Business vừa có thay đổi:');

      if (updates.handoffs && updates.handoffs.length) {
        parts.push('');
        parts.push('**Design Handoff mới:**');
        updates.handoffs.forEach(h => {
          const items = h.pendingItems > 0 ? ` — ${h.pendingItems} items cần implement` : '';
          parts.push(`  - ${h.title}${items}  (\`.worktrees/business/${h.file}\`)`);
        });
      }

      if (updates.tasks && updates.tasks.length) {
        parts.push('');
        parts.push('**Tasks mới từ business:**');
        updates.tasks.forEach(t => {
          const status = t.status ? ` [${t.status}]` : '';
          parts.push(`  - ${t.title}${status}`);
        });
      }

      if (updates.apiDocs && updates.apiDocs.length) {
        parts.push('');
        parts.push('**API Docs mới:**');
        updates.apiDocs.forEach(d => {
          const ep = d.endpointCount > 0 ? ` — ${d.endpointCount} endpoints` : '';
          const url = d.baseUrl ? ` (${d.baseUrl})` : '';
          parts.push(`  - ${d.title}${url}${ep}  (\`.worktrees/business/${d.file}\`)`);
        });
      }

      if (updates.docs && updates.docs.length) {
        parts.push('');
        parts.push('**Tài liệu mới:**');
        updates.docs.forEach(d => {
          parts.push(`  - ${d.title}  (\`.worktrees/business/${d.file}\`)`);
        });
      }
    }

    // Drift detection
    const drift = checkDrift();
    if (drift) {
      parts.push('');
      parts.push('[DRIFT] Tài liệu project có thể lỗi thời:');
      drift.errors.forEach(e => parts.push(`  ✗ ${e}`));
      drift.warnings.forEach(w => parts.push(`  ⚠ ${w}`));
      parts.push('Chạy `/learn` để cập nhật lại.');
    }

    // Gap detection
    const gaps = checkGaps();
    if (gaps) {
      parts.push('');
      parts.push('[GAP] Code mới chưa có coverage đầy đủ:');
      gaps.warnings.forEach(w => parts.push(`  ⚠ ${w}`));
      parts.push('Chạy `/tdd` để thêm tests, `/learn` để cập nhật architecture.md.');
    }
  }

  // ── Prompt action
  parts.push('');
  if (checkpoint) {
    // Có checkpoint — PM tự resume, không hỏi. User redirect nếu muốn làm khác.
    parts.push('[PM SESSION-START] Tự resume từ checkpoint ở trên. Không hỏi "muốn tiếp tục không?". Chỉ cần nói ngắn: đang tiếp tục [task] từ [currently/next step]. Nếu user muốn làm khác → họ sẽ tự nói.');
  } else if (role === 'business') {
    parts.push('Mô tả UI bạn muốn build hoặc tính năng cần làm.');
  } else {
    parts.push('Mô tả task bạn muốn làm.');
  }

  return parts.join('\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

try {
  const state = detectProjectState();
  const role = readUserRole();

  // Developer: sync business worktree
  let worktreeResult = null;
  if (role === 'developer') {
    try {
      worktreeResult = syncDesignerWorktree();
      if (worktreeResult?.action === 'updated') {
        process.stderr.write(`[SessionStart] Business branch: ${worktreeResult.newCount} commit mới → .worktrees/business/\n`);
      } else if (worktreeResult?.action === 'created') {
        process.stderr.write(`[SessionStart] Business worktree tạo mới tại .worktrees/business/\n`);
      }
    } catch (err) {
      process.stderr.write(`[SessionStart] Worktree sync skipped: ${err.message}\n`);
    }
  }

  // Designer path: sync đã được tích hợp vào buildContext qua syncDesignerBranchForDesigner()

  const additionalContext = buildContext(state, role, worktreeResult);

  // Đúng format chuẩn ECC cho SessionStart hook
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext
    }
  }));
} catch (err) {
  process.stderr.write(`[SessionStart] Error: ${err.message}\n`);
}

process.exit(0);
