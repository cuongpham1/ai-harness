#!/usr/bin/env node
/**
 * Compare two harness benchmark JSONL runs with responsibility attribution.
 * Usage: node benchmark/compare.mjs baseline.jsonl current.jsonl
 */
import fs from 'fs';
import path from 'path';

const [baselinePath, currentPath] = process.argv.slice(2);
if (!baselinePath || !currentPath) {
  console.error('Usage: node benchmark/compare.mjs <baseline.jsonl> <current.jsonl>');
  process.exit(1);
}

function loadJsonl(file) {
  const text = fs.readFileSync(path.resolve(file), 'utf8').trim();
  if (!text) return [];
  return text.split('\n').map(line => JSON.parse(line));
}

function passRate(rows) {
  if (!rows.length) return 0;
  return rows.filter(r => r.pass).length / rows.length;
}

function avgTraceTier(rows) {
  const tiers = rows
    .map(r => r.harnessMetrics?.traceTier)
    .filter(t => typeof t === 'number' && t > 0);
  if (!tiers.length) return null;
  return tiers.reduce((a, b) => a + b, 0) / tiers.length;
}

function compliancePct(rows) {
  return Math.round(passRate(rows) * 100);
}

function byResponsibility(rows) {
  const map = {};
  for (const r of rows) {
    const resp = r.harnessMetrics?.responsibility || 'unknown';
    if (!map[resp]) map[resp] = { pass: 0, total: 0 };
    map[resp].total++;
    if (r.pass) map[resp].pass++;
  }
  return map;
}

const baseline = loadJsonl(baselinePath);
const current = loadJsonl(currentPath);

const baseRate = passRate(baseline);
const currRate = passRate(current);
const baseCompliance = compliancePct(baseline);
const currCompliance = compliancePct(current);
const baseTier = avgTraceTier(baseline);
const currTier = avgTraceTier(current);

console.log('=== Harness Benchmark Compare (H3) ===');
console.log(`Baseline: ${baselinePath} (${baseline.length} tasks)`);
console.log(`Current:  ${currentPath} (${current.length} tasks)`);
console.log('');
console.log(`Pass rate:            ${(baseRate * 100).toFixed(1)}% → ${(currRate * 100).toFixed(1)}% (${currRate >= baseRate ? '+' : ''}${((currRate - baseRate) * 100).toFixed(1)}%)`);
console.log(`Harness compliance:   ${baseCompliance}% → ${currCompliance}%`);
if (baseTier !== null || currTier !== null) {
  console.log(`Trace quality avg:    ${baseTier?.toFixed(2) ?? 'n/a'} → ${currTier?.toFixed(2) ?? 'n/a'} / 3`);
}
console.log('');

const baseResp = byResponsibility(baseline);
const currResp = byResponsibility(current);
const allResp = new Set([...Object.keys(baseResp), ...Object.keys(currResp)]);

console.log('Responsibility attribution:');
console.log('responsibility       | baseline | current | delta');
console.log('---------------------|----------|---------|------');

for (const resp of [...allResp].sort()) {
  const b = baseResp[resp] || { pass: 0, total: 0 };
  const c = currResp[resp] || { pass: 0, total: 0 };
  const bPct = b.total ? Math.round((b.pass / b.total) * 100) : 0;
  const cPct = c.total ? Math.round((c.pass / c.total) * 100) : 0;
  const delta = cPct - bPct;
  const trend = delta > 0 ? 'improved' : delta < 0 ? 'regressed' : 'unchanged';
  console.log(
    `${resp.padEnd(20)} | ${String(bPct).padStart(6)}% | ${String(cPct).padStart(6)}% | ${delta >= 0 ? '+' : ''}${delta}% ${trend}`,
  );
}

console.log('');
console.log('Per-task delta:');
const currById = Object.fromEntries(current.map(r => [r.taskId, r]));
for (const b of baseline) {
  const c = currById[b.taskId];
  if (!c) {
    console.log(`  ${b.taskId}: missing in current run`);
    continue;
  }
  if (b.pass === c.pass) {
    console.log(`  ${b.taskId}: unchanged (${c.pass ? 'pass' : 'fail'})`);
  } else if (c.pass && !b.pass) {
    console.log(`  ${b.taskId}: IMPROVED fail → pass`);
  } else {
    console.log(`  ${b.taskId}: REGRESSED pass → fail`);
  }
}

const h3Target = currCompliance >= 85 && currCompliance <= 100;
console.log('');
console.log(h3Target
  ? 'H3 compliance target (≥85%): MET'
  : `H3 compliance target (≥85%): NOT MET (${currCompliance}%)`);

process.exit(currRate >= baseRate && h3Target ? 0 : 1);
