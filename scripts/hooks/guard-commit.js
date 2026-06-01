#!/usr/bin/env node
'use strict';

/**
 * PreToolUse hook — chặn `git commit` và `git push` từ subagents.
 *
 * Subagent (coder, debugger, etc.) không được phép commit trực tiếp.
 * Chỉ có PM (main agent) mới được commit sau khi review và test pass.
 *
 * Block bằng cách exit với JSON { "decision": "block", "reason": "..." }
 * Always exits 0 — chỉ block tool call, không crash session.
 */

const MAX_STDIN = 64 * 1024;
let stdinData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (stdinData.length < MAX_STDIN) stdinData += chunk;
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(stdinData);
    const cmd = input.tool_input?.command || '';

    const isCommit = /git\s+commit/.test(cmd);
    const isPush   = /git\s+push/.test(cmd);

    if (isCommit || isPush) {
      const isSubagent = !!input.agent_info?.is_subagent;
      if (isSubagent) {
        // Subagent tuyệt đối không được commit
        process.stdout.write(JSON.stringify({
          decision: 'block',
          reason: `Subagent không được phép \`${isCommit ? 'git commit' : 'git push'}\`. Báo cáo DONE cho PM — PM sẽ wrap up, hỏi user, rồi commit.`
        }));
        process.exit(0);
      } else {
        // PM (main agent): nhắc nhở phải có user approval
        process.stdout.write(JSON.stringify({
          systemMessage: `NHẮC NHỞ: Trước khi commit, bạn phải đảm bảo đã: (1) hiển thị wrap-up summary cho user, (2) nhận được user nói rõ "có" hoặc "commit". Nếu chưa làm — DỪNG, hiển thị wrap-up trước.`
        }));
        process.exit(0);
      }
    }
  } catch { /* ignore parse errors */ }

  process.exit(0);
});
