#!/usr/bin/env node
'use strict';

/**
 * PreToolUse Hook — gợi ý /compact tại các điểm hợp lý, theo 3 cấp độ.
 *
 * Hai chế độ trigger:
 *
 *   1) PRIMARY — context window usage (%).
 *      Claude Code gửi PreToolUse input qua stdin dạng JSON, có thể chứa:
 *        { "context_window": { "current_tokens": 70000,
 *                              "max_tokens": 1000000,
 *                              "percent_used": 7.0 } }
 *      Nếu có `context_window.percent_used`, hook dùng % làm tín hiệu chính.
 *      Đây là tín hiệu chính xác cho context lớn (vd Opus 1M) nơi số tool
 *      calls KHÔNG phản ánh đúng mức tiêu thụ context.
 *
 *   2) FALLBACK — đếm tool calls.
 *      Khi stdin không có context_window (hoặc parse lỗi), hook quay về đếm
 *      tool calls trong session như trước.
 *
 * Phản ứng tăng dần (cả hai chế độ):
 *   Tier 1 (yellow)  — cảnh báo nhẹ, gợi ý compact sớm
 *   Tier 2 (orange)  — cảnh báo mạnh, nên compact trước task lớn
 *   Tier 3 (red)     — chặn tool call, buộc /compact trước khi tiếp tục
 *
 * Tại sao không dùng auto-compact?
 * - Auto-compact xảy ra giữa chừng task → mất context quan trọng
 * - Strategic compact sau milestone → giữ plan, xóa noise
 *
 * Env vars — chế độ % (PRIMARY):
 *   COMPACT_PCT_TIER1 — ngưỡng cảnh báo vàng theo % (default: 60)
 *   COMPACT_PCT_TIER2 — ngưỡng cảnh báo cam theo %  (default: 80)
 *   COMPACT_PCT_TIER3 — ngưỡng chặn đỏ theo %       (default: 92)
 *
 * Env vars — chế độ count (FALLBACK):
 *   COMPACT_TIER1 — ngưỡng cảnh báo vàng (default: 30)
 *   COMPACT_TIER2 — ngưỡng cảnh báo cam  (default: 55)
 *   COMPACT_TIER3 — ngưỡng chặn đỏ       (default: 200)
 *                   (nâng từ 80 — 80 quá sớm trên context lớn)
 *
 * Tier 1/2 exit 0 không block. Tier 3 trả JSON {"decision":"block",...} ra
 * stdout và exit 0 — Claude Code sẽ chặn tool call và buộc compaction.
 *
 * Hook LUÔN exit 0. Lỗi đọc/parse stdin → fall through im lặng sang đếm count.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function parseTier(envVal, fallback) {
  const raw = parseInt(envVal, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function parsePct(envVal, fallback) {
  const raw = parseFloat(envVal);
  return Number.isFinite(raw) && raw > 0 && raw <= 100 ? raw : fallback;
}

// Count-based thresholds (fallback).
const TIER1 = parseTier(process.env.COMPACT_TIER1, 30); // yellow warning
const TIER2 = parseTier(process.env.COMPACT_TIER2, 55); // orange strong
const TIER3 = parseTier(process.env.COMPACT_TIER3, 200); // red block

// Percent-based thresholds (primary).
const PCT_TIER1 = parsePct(process.env.COMPACT_PCT_TIER1, 60); // yellow
const PCT_TIER2 = parsePct(process.env.COMPACT_PCT_TIER2, 80); // orange
const PCT_TIER3 = parsePct(process.env.COMPACT_PCT_TIER3, 92); // red block

function getCounterFile() {
  const sessionId = (process.env.CLAUDE_SESSION_ID || 'default')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 32) || 'default';
  return path.join(os.tmpdir(), `smart-bootstrap-tool-count-${sessionId}`);
}

function readAndIncrement(counterFile) {
  try {
    const fd = fs.openSync(counterFile, 'a+');
    try {
      const buf = Buffer.alloc(64);
      const bytesRead = fs.readSync(fd, buf, 0, 64, 0);
      let count = 1;
      if (bytesRead > 0) {
        const parsed = parseInt(buf.toString('utf8', 0, bytesRead).trim(), 10);
        count = (Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000)
          ? parsed + 1
          : 1;
      }
      fs.ftruncateSync(fd, 0);
      fs.writeSync(fd, String(count), 0);
      return count;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return 1;
  }
}

// Read stdin async with a short timeout fallback (PreToolUse JSON payload).
function readStdin() {
  return new Promise(resolve => {
    let data = '';
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(data); } };
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => { data += chunk; });
      process.stdin.on('end', finish);
      process.stdin.on('error', finish);
    } catch {
      finish();
      return;
    }
    setTimeout(finish, 200);
  });
}

// Extract { percent_used, current_tokens, max_tokens } from a parsed payload,
// or null if context window info is absent/invalid.
function extractContext(payload) {
  const cw = payload && payload.context_window;
  if (!cw || typeof cw !== 'object') return null;

  let pct = parseFloat(cw.percent_used);
  const current = parseFloat(cw.current_tokens);
  const max = parseFloat(cw.max_tokens);

  // Derive percent from token counts if percent_used is missing/invalid.
  if (!(Number.isFinite(pct) && pct >= 0) &&
      Number.isFinite(current) && Number.isFinite(max) && max > 0) {
    pct = (current / max) * 100;
  }

  if (!(Number.isFinite(pct) && pct >= 0)) return null;

  return {
    pct,
    current: Number.isFinite(current) ? current : null,
    max: Number.isFinite(max) ? max : null,
  };
}

function fmtTokens(n) {
  if (!Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

function tokenSuffix(ctx) {
  if (ctx.current == null || ctx.max == null) return '';
  return ` (${fmtTokens(ctx.current)}/${fmtTokens(ctx.max)} tokens)`;
}

// Decide reaction from context %. Returns true if a block was emitted.
function reactByPercent(ctx) {
  const pct = ctx.pct;
  const pctStr = pct.toFixed(1);
  const tok = tokenSuffix(ctx);

  if (pct >= PCT_TIER3) {
    process.stderr.write(
      `🔴 Context CRITICAL: ${pctStr}% used${tok}. Blocking — run /compact now.\n`
    );
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: `Context window critical (${pctStr}% used${tok}). Run /compact before continuing.`,
      })
    );
    return true;
  }
  if (pct >= PCT_TIER2) {
    process.stderr.write(
      `🟠 Context large: ${pctStr}% used${tok}. Run /compact before next major task.\n`
    );
    return false;
  }
  if (pct >= PCT_TIER1) {
    process.stderr.write(
      `⚠️  Context growing: ${pctStr}% used${tok}. Consider /compact soon.\n`
    );
    return false;
  }
  return false;
}

// Decide reaction from tool-call count (fallback).
function reactByCount(count) {
  if (count >= TIER3) {
    process.stderr.write(
      `🔴 Context CRITICAL: ${count} tool calls. Blocking — run /compact now.\n`
    );
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: `Context window critical (${count} tool calls). Run /compact before continuing.`,
      })
    );
    return;
  }
  if (count >= TIER2) {
    process.stderr.write(
      `🟠 Context large: ${count} tool calls. Run /compact before next major task.\n` +
      `   → /compact now will save ~${count * 2}k tokens of context headroom.\n`
    );
    return;
  }
  if (count >= TIER1) {
    process.stderr.write(
      `⚠️  Context growing: ${count} tool calls. Consider /compact soon.\n`
    );
  }
}

async function main() {
  const counterFile = getCounterFile();

  // PreCompact mode: clear the counter so the tier ladder restarts after a
  // /compact. Without this the counter only ever grows and Tier 3 would block
  // every tool call forever (deadlock) since /compact never resets it.
  if (process.argv[2] === 'reset') {
    try { fs.unlinkSync(counterFile); } catch { /* already gone */ }
    return;
  }

  // Always increment the count — used as the fallback signal.
  let count = 1;
  try { count = readAndIncrement(counterFile); } catch { /* ignore */ }

  // Try the primary signal: context window %.
  let ctx = null;
  try {
    const raw = (await readStdin()).trim();
    if (raw) {
      const payload = JSON.parse(raw);
      ctx = extractContext(payload);
    }
  } catch {
    // Parse/read error — never block; fall through to count-based logic.
    ctx = null;
  }

  if (ctx) {
    reactByPercent(ctx);
  } else {
    reactByCount(count);
  }
}

main()
  .catch(err => {
    try { process.stderr.write(`[Compact] ${err.message}\n`); } catch { /* ignore */ }
  })
  .finally(() => process.exit(0));
