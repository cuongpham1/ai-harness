#!/usr/bin/env node
/** Smoke test for pipeline-checkpoint (backlog-27). Run: node pipeline-checkpoint.test.mjs */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { normalizeStage, recordStage, resolveActiveTask } from './pipeline-checkpoint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(__dirname, 'pipeline-checkpoint.mjs');
let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); console.log(`PASS ${msg}`); pass++; };

// 1. normalizeStage maps labels → canonical stage
ok(normalizeStage('coder') === 'coder', 'normalizeStage coder');
ok(normalizeStage('spec-reviewer') === 'spec-reviewer', 'normalizeStage spec-reviewer');
ok(normalizeStage('reviewer') === 'reviewer', 'normalizeStage reviewer');
ok(normalizeStage('tester') === 'tester', 'normalizeStage tester');
ok(normalizeStage('solution-architect') === 'solution-architect', 'normalizeStage architect');
ok(normalizeStage('cavecrew-investigator') === null, 'normalizeStage non-pipeline → null');

// 2. recordStage advances nextStage in canonical order
const task = { id: 'task-x', lane: 'normal' };
let s = { version: 1, tasks: {} };
s = recordStage(s, task, 'coder', 'done', 't1');
ok(s.tasks['task-x'].nextStage === 'spec-reviewer', 'after coder → next spec-reviewer');
ok(s.tasks['task-x'].done === false, 'pipeline not done after coder');
s = recordStage(s, task, 'spec-reviewer', 'done', 't2');
s = recordStage(s, task, 'reviewer', 'done', 't3');
s = recordStage(s, task, 'tester', 'done', 't4');
ok(s.tasks['task-x'].done === true, 'pipeline done after tester');
ok(s.tasks['task-x'].nextStage === null, 'nextStage null when done');

// 3. recordStage idempotent + out-of-order keeps canonical order
let s2 = recordStage({ version: 1, tasks: {} }, task, 'reviewer', null, 't');
ok(s2.tasks['task-x'].nextStage === 'coder', 'out-of-order reviewer still needs coder first');
s2 = recordStage(s2, task, 'reviewer', null, 't'); // duplicate
ok(s2.tasks['task-x'].completed.filter(x => x === 'reviewer').length === 1, 'no duplicate stage');

// 4. tiny lane is single-stage
let s3 = recordStage({ version: 1, tasks: {} }, { id: 't', lane: 'tiny' }, 'coder', null, 't');
ok(s3.tasks['t'].done === true, 'tiny lane done after coder');

// 5. resolveActiveTask reads in_progress task file + lane
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcp-'));
fs.writeFileSync(path.join(tmp, 'task-9.md'), '# Task: t9\n**Status:** in_progress\n**Lane:** normal\n');
fs.writeFileSync(path.join(tmp, 'task-8.md'), '# Task: t8\n**Status:** done\n**Lane:** tiny\n');
const active = resolveActiveTask(tmp);
ok(active && active.id === 'task-9' && active.lane === 'normal', 'resolveActiveTask picks in_progress');

// 6. end-to-end: hook writes pipeline-state.json from stdin payload
const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'pcp-proj-'));
fs.mkdirSync(path.join(proj, '.project-manager', 'tasks'), { recursive: true });
fs.writeFileSync(path.join(proj, '.project-manager', 'tasks', 'task-1.md'),
  '# Task: t1\n**Status:** in_progress\n**Lane:** normal\n');
const r = spawnSync(process.execPath, [HOOK], {
  cwd: proj, input: JSON.stringify({ subagent_type: 'coder', result: 'DONE' }), encoding: 'utf8',
});
ok(r.status === 0, 'hook exits 0');
const written = JSON.parse(fs.readFileSync(path.join(proj, 'kg', 'runtime', 'pipeline-state.json'), 'utf8'));
ok(written.tasks['task-1'].lastStage === 'coder' && written.tasks['task-1'].nextStage === 'spec-reviewer',
  'hook recorded coder + nextStage spec-reviewer');

fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(proj, { recursive: true, force: true });
console.log(`\n${pass} assertions passed`);
