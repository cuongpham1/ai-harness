#!/usr/bin/env node
/**
 * Cursor beforeShellExecution — dangerous commands + git commit guard.
 */
import { readStdinJson, writeJson } from './lib.mjs';

const DANGEROUS = [
  { pattern: /git\s+push\s+--force(?!-with-lease)/i, reason: 'git push --force can overwrite remote history. Use --force-with-lease.' },
  { pattern: /git\s+push\s+[^-]*\bmain\b.*--force/i, reason: 'Force push to main is blocked.' },
  { pattern: /git\s+reset\s+--hard\s+(?!HEAD)/i, reason: 'git reset --hard to old commit destroys uncommitted work.' },
  { pattern: /git\s+clean\s+-[a-zA-Z]*f/i, reason: 'git clean -f permanently deletes untracked files.' },
  { pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+\/(?!\w)/i, reason: 'rm -rf / is blocked.' },
  { pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+~(?:\/|$|\s)/i, reason: 'rm -rf ~ is blocked.' },
  { pattern: /pkill\s+-9\s/i, reason: 'pkill -9 force kill blocked; use graceful stop.' },
];

const input = await readStdinJson();
const command = input.command || input.tool_input?.command || '';

for (const { pattern, reason } of DANGEROUS) {
  if (pattern.test(command)) {
    writeJson({
      permission: 'deny',
      user_message: reason,
      agent_message: `Blocked shell command: ${reason}`,
    });
    process.exit(0);
  }
}

if (/git\s+(commit|push)/.test(command)) {
  writeJson({
    permission: 'ask',
    user_message: 'Git commit/push requires explicit user approval after wrap-up and tests.',
    agent_message: 'Confirm user approved commit. Subagents must not commit — report to PM.',
  });
  process.exit(0);
}

writeJson({ permission: 'allow' });
process.exit(0);
