#!/usr/bin/env node
'use strict';

/**
 * PreToolUse(Bash) hook — block dangerous shell commands.
 * Exit 2 to block + show reason. Exit 0 to allow.
 */

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input);
    const command = payload.tool_input?.command || '';

    const DANGEROUS = [
      {
        pattern: /git\s+push\s+--force(?!-with-lease)/i,
        reason: 'git push --force có thể ghi đè lịch sử remote. Dùng --force-with-lease thay thế.'
      },
      {
        pattern: /git\s+push\s+[^-]*\bmain\b.*--force/i,
        reason: 'Force push lên branch main bị cấm tuyệt đối.'
      },
      {
        pattern: /git\s+reset\s+--hard\s+(?!HEAD)/i,
        reason: 'git reset --hard về commit cũ sẽ mất uncommitted changes. Xác nhận với user trước.'
      },
      {
        pattern: /git\s+clean\s+-[a-zA-Z]*f/i,
        reason: 'git clean -f xóa untracked files vĩnh viễn, không thể khôi phục.'
      },
      {
        pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+\/(?!\w)/i,
        reason: 'rm -rf / cực kỳ nguy hiểm — xóa toàn bộ filesystem.'
      },
      {
        pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+~(?:\/|$|\s)/i,
        reason: 'rm -rf ~ sẽ xóa toàn bộ home directory.'
      },
      {
        pattern: /pkill\s+-9\s/i,
        reason: 'pkill -9 là force kill, không cho process shutdown gracefully. Dùng pkill hoặc graceful stop command.'
      },
      {
        pattern: /kill\s+-9\s+1\b/i,
        reason: 'kill -9 1 sẽ kill init process.'
      },
    ];

    for (const { pattern, reason } of DANGEROUS) {
      if (pattern.test(command)) {
        process.stderr.write(
          `🚫 [BLOCKED] Lệnh bị chặn vì nguy hiểm:\n` +
          `   Lý do: ${reason}\n` +
          `   Lệnh:  ${command.trim()}\n` +
          `   Nếu chắc chắn muốn chạy, hãy xin phép user trước.\n`
        );
        process.exit(2);
        return;
      }
    }
  } catch {
    // Parse error — allow through
  }
  process.exit(0);
});
