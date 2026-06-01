#!/usr/bin/env node
'use strict';

/**
 * PreToolUse Hook — gợi ý /compact tại các điểm hợp lý.
 *
 * Đếm tool calls trong session. Sau 50 calls → nhắc user compact
 * nếu đang chuyển phase (explore → implement, milestone → milestone mới).
 *
 * Tại sao không dùng auto-compact?
 * - Auto-compact xảy ra giữa chừng task → mất context quan trọng
 * - Strategic compact sau milestone → giữ plan, xóa noise
 *
 * Env vars:
 *   COMPACT_THRESHOLD — số tool calls trước khi gợi ý (default: 50)
 *
 * Always exits 0 — không bao giờ block tool execution.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const rawThreshold = parseInt(process.env.COMPACT_THRESHOLD || '50', 10);
const THRESHOLD = Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 50;

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
  const count = readAndIncrement(counterFile);

  if (count === THRESHOLD) {
    process.stderr.write(
      `[Compact] ${THRESHOLD} tool calls — nếu đang chuyển phase (explore→implement, sau milestone), hãy chạy /compact\n`
    );
  } else if (count > THRESHOLD && (count - THRESHOLD) % 25 === 0) {
    process.stderr.write(
      `[Compact] ${count} tool calls — context có thể đang bị noise, cân nhắc /compact\n`
    );
  }
} catch (err) {
  process.stderr.write(`[Compact] ${err.message}\n`);
}

process.exit(0);
