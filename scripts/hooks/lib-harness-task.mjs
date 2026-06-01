/**
 * Shared task-file parsing for harness hooks (trace, story, verify).
 */
import fs from 'fs';
import path from 'path';

export function projectRoot(cwd = process.cwd()) {
  try {
    return fs.realpathSync(cwd);
  } catch {
    return cwd;
  }
}

export function tasksDir(root) {
  return path.join(root, '.project-manager', 'tasks');
}

export function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

export function taskField(content, name) {
  const re = new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+?)(?=\\n|$)`, 'i');
  const m = content.match(re);
  return m ? m[1].trim() : '';
}

export function normalizeLane(raw) {
  if (!raw) return 'normal';
  const lane = raw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (lane === 'high_risk' || lane === 'highrisk') return 'high_risk';
  if (lane === 'tiny' || lane === 'normal') return lane;
  return 'normal';
}

export function normalizeStoryId(raw) {
  if (!raw) return '';
  const id = raw.trim().replace(/[()]/g, '');
  if (!id || /^optional$/i.test(id) || id.includes('(')) return '';
  return id;
}

export function parseAfterWorkSections(content) {
  const sections = [];
  const re = /### After-Work — ([^\n]+)\n([\s\S]*?)(?=### After-Work —|$)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    sections.push({ date: m[1].trim(), body: m[2] });
  }
  return sections;
}

export function afterWorkField(body, name) {
  const re = new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|$)`, 'is');
  const m = body.match(re);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '';
}

export function listTaskFiles(root) {
  const dir = tasksDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({
      taskId: f.replace(/\.md$/, ''),
      path: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
}

/** Prefer in_progress; else most recently modified task with content. */
export function pickActiveTask(root) {
  const files = listTaskFiles(root);
  for (const f of files) {
    const content = readFileSafe(f.path);
    if (!content) continue;
    const status = taskField(content, 'Status').toLowerCase();
    if (status === 'in_progress' || status === 'in progress') {
      return { ...f, content };
    }
  }
  for (const f of files) {
    const content = readFileSafe(f.path);
    if (content) return { ...f, content };
  }
  return null;
}

export function latestAfterWork(content) {
  const sections = parseAfterWorkSections(content);
  return sections.length ? sections[sections.length - 1] : null;
}

/**
 * True only when verify-last.json represents a real proof pass for this task.
 * Skips, dry-runs, stale invalidations, and legacy ok-only reports return false.
 */
export function isProofVerifyReport(report, taskId, taskContent = null) {
  if (!report || typeof report !== 'object') return false;
  if (report.task !== taskId) return false;

  if (report.proof === false || report.stale === true) return false;
  if (report.proof === true) {
    if (!taskContent) return true;
    const latest = latestAfterWork(taskContent);
    const outcome = latest ? afterWorkField(latest.body, 'Outcome').toLowerCase() : '';
    return outcome === 'completed';
  }

  // Legacy reports (no proof field): require stack evidence, not a skip shape
  if (
    report.ok &&
    report.evidence &&
    !report.skipped &&
    !report.dry_run &&
    !report.skipped_stack
  ) {
    if (!taskContent) return true;
    const latest = latestAfterWork(taskContent);
    const outcome = latest ? afterWorkField(latest.body, 'Outcome').toLowerCase() : '';
    return outcome === 'completed';
  }

  // Tiny lane: no stack proof required, but After-Work must still say completed
  if (report.lane === 'tiny' && report.skipped_stack && report.ok) {
    if (!taskContent) return true;
    const latest = latestAfterWork(taskContent);
    const outcome = latest ? afterWorkField(latest.body, 'Outcome').toLowerCase() : '';
    return outcome === 'completed';
  }

  return false;
}

export function writeVerifyReport(reportPath, payload) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`);
}
