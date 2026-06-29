#!/usr/bin/env node
'use strict';

/**
 * PreToolUse Hook — gợi ý /compact tại các điểm hợp lý, theo 3 cấp độ.
 *
 * Đếm tool calls trong session, phản ứng tăng dần:
 *   Tier 1 (yellow)  — cảnh báo nhẹ, gợi ý compact sớm
 *   Tier 2 (orange)  — cảnh báo mạnh, nên compact trước task lớn
 *   Tier 3 (red)     — chặn tool call, buộc /compact trước khi tiếp tục
 *
 * Tại sao không dùng auto-compact?
 * - Auto-compact xảy ra giữa chừng task → mất context quan trọng
 * - Strategic compact sau milestone → giữ plan, xóa noise
 *
 * Env vars:
 *   COMPACT_TIER1 — ngưỡng cảnh báo vàng (default: 30)
 *   COMPACT_TIER2 — ngưỡng cảnh báo cam (default: 55)
 *   COMPACT_TIER3 — ngưỡng chặn đỏ      (default: 80)
 *
 * Tier 1/2 exit 0 không block. Tier 3 trả JSON {"decision":"block",...} ra
 * stdout và exit 0 — Claude Code sẽ chặn tool call và buộc compaction.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function parseTier(envVal, fallback) {
  const raw = parseInt(envVal, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

const TIER1 = parseTier(process.env.COMPACT_TIER1, 30); // yellow warning
const TIER2 = parseTier(process.env.COMPACT_TIER2, 55); // orange strong
const TIER3 = parseTier(process.env.COMPACT_TIER3, 80); // red block

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

try {
  const counterFile = getCounterFile();

  // PreCompact mode: clear the counter so the tier ladder restarts after a
  // /compact. Without this the counter only ever grows and Tier 3 would block
  // every tool call forever (deadlock) since /compact never resets it.
  if (process.argv[2] === 'reset') {
    try { fs.unlinkSync(counterFile); } catch { /* already gone */ }
    process.exit(0);
  }

  const count = readAndIncrement(counterFile);

  if (count >= TIER3) {
    // Tier 3 — red: block the tool call and force /compact.
    process.stderr.write(
      `🔴 Context CRITICAL: ${count} tool calls. Blocking — run /compact now.\n`
    );
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: `Context window critical (${count} tool calls). Run /compact before continuing.`,
      })
    );
  } else if (count >= TIER2) {
    // Tier 2 — orange: strong nudge, do not block.
    process.stderr.write(
      `🟠 Context large: ${count} tool calls. Run /compact before next major task.\n` +
      `   → /compact now will save ~${count * 2}k tokens of context headroom.\n`
    );
  } else if (count >= TIER1) {
    // Tier 1 — yellow: gentle warning.
    process.stderr.write(
      `⚠️  Context growing: ${count} tool calls. Consider /compact soon.\n`
    );
  }
} catch (err) {
  process.stderr.write(`[Compact] ${err.message}\n`);
}

process.exit(0);
