#!/usr/bin/env node
/**
 * Trace viewer — query kg/traces/YYYY-MM-DD.jsonl
 *
 * Usage:
 *   node scripts/trace-viewer.mjs                        # today, last 20
 *   node scripts/trace-viewer.mjs --tail 50              # last 50
 *   node scripts/trace-viewer.mjs --date 2026-05-29      # specific date
 *   node scripts/trace-viewer.mjs --agent coder          # filter agentType
 *   node scripts/trace-viewer.mjs --stats                # summary table
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CWD = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
const KG_TRACES = path.join(CWD, 'kg', 'traces');

// ANSI colors
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  white:  '\x1b[37m',
};

function pad(str, len, right = false) {
  const s = String(str);
  if (right) return s.padStart(len, ' ');
  return s.padEnd(len, ' ');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { tail: 20, date: null, agent: null, stats: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tail' && args[i + 1]) { opts.tail = parseInt(args[++i], 10); }
    else if (args[i] === '--date' && args[i + 1]) { opts.date = args[++i]; }
    else if (args[i] === '--agent' && args[i + 1]) { opts.agent = args[++i]; }
    else if (args[i] === '--stats') { opts.stats = true; }
  }
  return opts;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadTraces(dateStr) {
  const file = path.join(KG_TRACES, `${dateStr}.jsonl`);
  try {
    return fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function formatTime(ts) {
  try {
    return new Date(ts).toISOString().slice(11, 19); // HH:MM:SS
  } catch {
    return '??:??:??';
  }
}

function eventLabel(event) {
  if (event === 'agent_start') return `${C.green}START${C.reset}`;
  if (event === 'agent_stop')  return `${C.yellow}STOP ${C.reset}`;
  return `${C.dim}${event}${C.reset}`;
}

function printEntries(entries) {
  if (entries.length === 0) {
    console.log(`${C.dim}No trace entries found.${C.reset}`);
    return;
  }
  for (const e of entries) {
    const time = formatTime(e.ts);
    const label = eventLabel(e.event);
    const agent = `${C.cyan}@${e.agentType || 'unknown'}${C.reset}`;
    const desc  = e.description ? ` ${C.dim}"${e.description.slice(0, 60)}"${C.reset}` : '';
    const dur   = e.durationMs != null ? ` ${C.magenta}(${e.durationMs}ms)${C.reset}` : '';
    const result = e.result ? ` ${C.dim}[${e.result}]${C.reset}` : '';
    console.log(`${C.bold}${time}${C.reset} [${label}] ${agent}${desc}${result}${dur}`);
  }
}

function printStats(entries) {
  const stats = {};
  for (const e of entries) {
    const t = e.agentType || 'unknown';
    if (!stats[t]) stats[t] = { calls: 0, totalDur: 0, durations: [] };
    stats[t].calls++;
    if (e.durationMs != null) {
      stats[t].totalDur += e.durationMs;
      stats[t].durations.push(e.durationMs);
    }
  }

  console.log(`\n${C.bold}Agent Stats${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(58)}${C.reset}`);
  console.log(
    `${C.bold}${pad('Agent', 16)} ${pad('Calls', 7, true)} ${pad('Avg Duration', 14, true)} ${pad('Total Duration', 14, true)}${C.reset}`
  );
  console.log(`${C.dim}${'─'.repeat(58)}${C.reset}`);

  const rows = Object.entries(stats).sort((a, b) => b[1].calls - a[1].calls);
  for (const [agent, s] of rows) {
    const avg = s.durations.length ? Math.round(s.totalDur / s.durations.length) : '-';
    const total = s.durations.length ? `${s.totalDur}ms` : '-';
    const avgStr = s.durations.length ? `${avg}ms` : '-';
    console.log(
      `${C.cyan}${pad(agent, 16)}${C.reset} ` +
      `${pad(s.calls, 7, true)} ` +
      `${C.magenta}${pad(avgStr, 14, true)}${C.reset} ` +
      `${C.yellow}${pad(total, 14, true)}${C.reset}`
    );
  }
  console.log(`${C.dim}${'─'.repeat(58)}${C.reset}`);
  console.log(`${C.dim}Total entries: ${entries.length}${C.reset}\n`);
}

function main() {
  const opts = parseArgs();
  const dateStr = opts.date || todayStr();

  let entries = loadTraces(dateStr);

  if (opts.agent) {
    entries = entries.filter(e => (e.agentType || '').includes(opts.agent));
  }

  if (opts.stats) {
    printStats(entries);
    return;
  }

  // Apply tail limit
  const tail = Math.max(1, opts.tail);
  const sliced = entries.slice(-tail);

  console.log(`${C.bold}Traces for ${dateStr}${C.reset}${opts.agent ? ` (agent: ${opts.agent})` : ''} — ${sliced.length} entries`);
  console.log(`${C.dim}${'─'.repeat(70)}${C.reset}`);
  printEntries(sliced);
}

main();
