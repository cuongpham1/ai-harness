#!/usr/bin/env node
/**
 * Deterministic harness benchmark runner (H3).
 * No live agent required.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TASKS_DIR = path.join(ROOT, 'benchmark', 'tasks');
const RESULTS_DIR = path.join(ROOT, 'benchmark', 'results');
const CLI = path.join(ROOT, 'scripts', 'bin', 'harness-cli');

fs.mkdirSync(RESULTS_DIR, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = path.join(RESULTS_DIR, `${ts}-harness.jsonl`);

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
    ...opts,
  });
}

function harnessMetrics(partial) {
  return {
    traceTier: null,
    laneRequired: null,
    complianceChecks: {},
    frictionComponent: null,
    responsibility: null,
    ...partial,
  };
}

function writeResult(result) {
  fs.appendFileSync(outFile, JSON.stringify(result) + '\n');
}

function checkHandoff() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-bench-'));
  const tasksDir = path.join(tmpDir, '.project-manager', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(
    path.join(tasksDir, 'bench-handoff.md'),
    '# Task: Bench handoff\n**Status:** in_progress\n## Notes\n',
  );

  const hook = path.join(ROOT, 'scripts/hooks/check-task-handoff.js');
  const r = run(process.execPath, [hook], { cwd: tmpDir });
  const pass = r.status === 2;
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return {
    taskId: 'harness-01-handoff',
    category: 'harness',
    pass,
    failReason: pass ? null : 'Expected exit 2 when in_progress lacks After-Work',
    harnessMetrics: harnessMetrics({
      responsibility: 'task_state',
      complianceChecks: { handoffBlocks: pass },
    }),
  };
}

function checkSync() {
  if (!fs.existsSync(CLI)) {
    return {
      taskId: 'harness-02-sync',
      category: 'harness',
      pass: false,
      failReason: 'harness-cli missing',
      harnessMetrics: harnessMetrics({ responsibility: 'task_state' }),
    };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-bench-'));
  for (const rel of ['scripts/bin/harness-cli', 'scripts/hooks/sync-harness-trace.mjs', 'scripts/schema']) {
    const src = path.join(ROOT, rel);
    const dst = path.join(tmpDir, rel);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      if (fs.statSync(src).isDirectory()) {
        fs.cpSync(src, dst, { recursive: true });
      } else {
        fs.copyFileSync(src, dst);
        if (rel.endsWith('harness-cli')) fs.chmodSync(dst, 0o755);
      }
    }
  }

  const tasksDir = path.join(tmpDir, '.project-manager', 'tasks');
  fs.mkdirSync(path.join(tmpDir, 'kg', 'runtime'), { recursive: true });
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(
    path.join(tasksDir, 'bench-sync.md'),
    `# Task: Bench sync
**Status:** done
**Lane:** normal
## Notes
### After-Work — 2026-06-01
**Agent:** tester
**Outcome:** completed
**Done:** Harness benchmark sync smoke test verification run
**Files changed:** benchmark/run-harness.mjs
**Errors:** none
**Friction:** none
`,
  );

  const tmpCli = path.join(tmpDir, 'scripts/bin/harness-cli');
  run(tmpCli, ['init'], { cwd: tmpDir, stdio: 'pipe' });

  const syncHook = path.join(tmpDir, 'scripts/hooks/sync-harness-trace.mjs');
  const syncRun = run(process.execPath, [syncHook], { cwd: tmpDir, stdio: 'pipe' });
  const sql = run(tmpCli, ['query', 'sql', 'SELECT COUNT(*) FROM trace'], { cwd: tmpDir });
  const sqlLines = (sql.stdout || '').trim().split('\n');
  const count = parseInt(sqlLines[sqlLines.length - 1]?.trim() || '0', 10) || 0;
  const pass = count >= 1 && syncRun.status === 0;
  const failDetail = pass ? null : `sync exit ${syncRun.status}, trace count ${count}, stderr: ${(syncRun.stderr || '').slice(0, 80)}`;

  fs.rmSync(tmpDir, { recursive: true, force: true });

  return {
    taskId: 'harness-02-sync',
    category: 'harness',
    pass,
    failReason: pass ? null : failDetail || 'Trace not recorded after sync',
    harnessMetrics: harnessMetrics({
      responsibility: 'task_state',
      complianceChecks: { traceSynced: pass },
    }),
  };
}

function checkScore() {
  if (!fs.existsSync(CLI)) {
    return {
      taskId: 'harness-03-score',
      category: 'harness',
      pass: false,
      failReason: 'harness-cli missing',
      harnessMetrics: harnessMetrics({ responsibility: 'observability' }),
    };
  }

  run(CLI, ['init'], { stdio: 'pipe' });
  const intakeOut = run(CLI, [
    'intake', '--type', 'change_request', '--summary', 'bench score', '--lane', 'normal',
  ], { stdio: 'pipe' });
  const intakeMatch = (intakeOut.stdout || '').match(/Intake #(\d+)/);
  const intakeId = intakeMatch ? intakeMatch[1] : null;

  const traceArgs = [
    'trace',
    '--summary', 'Harness benchmark score trace with enough detail for standard tier',
    '--agent', 'tester',
    '--outcome', 'completed',
    '--errors', 'none',
    '--friction', 'none',
    '--actions', 'ran benchmark,verified score-trace',
    '--read', 'benchmark/run-harness.mjs,docs/TRACE_SPEC.md',
    '--changed', 'benchmark/run-harness.mjs',
  ];
  if (intakeId) traceArgs.push('--intake', intakeId);

  run(CLI, traceArgs, { stdio: 'pipe' });
  const score = run(CLI, ['score-trace'], { stdio: 'pipe' });
  const out = (score.stdout || '') + (score.stderr || '');
  const tierMatch = out.match(/Tier achieved:\s*\w+\s*\((\d)\/3\)/);
  const tier = tierMatch ? Number(tierMatch[1]) : 0;
  const meets = /MEETS REQUIREMENT/i.test(out);
  const pass = score.status === 0 && tier >= 2 && meets;

  return {
    taskId: 'harness-03-score',
    category: 'harness',
    pass,
    failReason: pass ? null : out.trim().slice(0, 120) || 'score-trace failed',
    harnessMetrics: harnessMetrics({
      responsibility: 'observability',
      traceTier: tier,
      laneRequired: 2,
      complianceChecks: { scorePass: pass },
    }),
  };
}

function checkFriction() {
  const script = path.join(ROOT, 'scripts/friction-by-component.mjs');
  if (!fs.existsSync(script)) {
    return {
      taskId: 'harness-04-friction',
      category: 'harness',
      pass: false,
      failReason: 'friction-by-component.mjs missing',
      harnessMetrics: harnessMetrics({ responsibility: 'failure_attribution' }),
    };
  }

  const r = run(process.execPath, [script, '--json'], { stdio: 'pipe' });
  let parsed;
  try {
    parsed = JSON.parse(r.stdout || '{}');
  } catch {
    parsed = {};
  }
  const pass = Array.isArray(parsed.components) && parsed.taggedTags >= 5;

  return {
    taskId: 'harness-04-friction',
    category: 'harness',
    pass,
    failReason: pass ? null : 'Expected ≥5 tagged friction components defined',
    harnessMetrics: harnessMetrics({
      responsibility: 'failure_attribution',
      frictionComponent: parsed.components?.[0]?.name || null,
      complianceChecks: { frictionGrouped: pass },
    }),
  };
}

function checkBacklog() {
  if (!fs.existsSync(CLI)) {
    return {
      taskId: 'harness-05-backlog',
      category: 'harness',
      pass: false,
      failReason: 'harness-cli missing',
      harnessMetrics: harnessMetrics({ responsibility: 'entropy_auditing' }),
    };
  }

  run(CLI, ['init'], { stdio: 'pipe' });
  const add = run(CLI, [
    'backlog', 'add',
    '--title', 'H3 bench item',
    '--pain', 'benchmark test',
    '--predicted', 'compliance improves',
  ], { stdio: 'pipe' });
  const idMatch = (add.stdout || '').match(/Backlog #(\d+)/);
  const id = idMatch ? idMatch[1] : '1';

  run(CLI, ['backlog', 'close', '--id', id, '--outcome', 'bench verified loop'], { stdio: 'pipe' });
  const closed = run(CLI, ['query', 'backlog', '--closed'], { stdio: 'pipe' });
  const pass = (closed.stdout || '').includes('H3 bench item') &&
    (closed.stdout || '').includes('compliance improves');

  return {
    taskId: 'harness-05-backlog',
    category: 'harness',
    pass,
    failReason: pass ? null : 'predicted/outcome not visible in closed backlog',
    harnessMetrics: harnessMetrics({
      responsibility: 'entropy_auditing',
      complianceChecks: { backlogLoop: pass },
    }),
  };
}

const checks = [checkHandoff, checkSync, checkScore, checkFriction, checkBacklog];
let passCount = 0;

console.log('=== Harness Benchmark (H3) ===');
console.log(`Output: ${outFile}\n`);

for (const fn of checks) {
  const start = Date.now();
  const result = fn();
  result.durationMs = Date.now() - start;
  result.startTs = new Date(start).toISOString();
  result.endTs = new Date().toISOString();
  writeResult(result);
  console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.taskId}${result.failReason ? ': ' + result.failReason : ''}`);
  if (result.pass) passCount++;
}

const total = checks.length;
const pct = Math.round((passCount / total) * 100);
console.log(`\nSummary: ${passCount}/${total} (${pct}% harness compliance)`);
console.log(`Results: ${outFile}`);

process.exit(passCount === total ? 0 : 1);
