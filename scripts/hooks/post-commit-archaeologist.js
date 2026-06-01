#!/usr/bin/env node
'use strict';

/**
 * PostToolUse hook — remind to run archaeologist analysis after git commit.
 *
 * When a successful `git commit` is detected, outputs a systemMessage
 * reminding the agent to check whether archaeologist re-analysis is needed.
 *
 * Always exits 0 — never blocks tool execution.
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

    if (/git\s+commit/.test(cmd)) {
      process.stdout.write(JSON.stringify({
        systemMessage: 'Code changed — run check_analysis_needed to see if archaeologist should re-analyze.'
      }));
    }
  } catch { /* ignore parse errors */ }

  process.exit(0);
});
