#!/usr/bin/env node
/**
 * Cursor preToolUse — content guard for Write/Edit (secrets, .env).
 */
import { readStdinJson, writeJson } from './lib.mjs';

const input = await readStdinJson();
const tool = input.tool_name || input.tool || '';
if (!/Write|Edit|ApplyPatch/i.test(tool)) {
  writeJson({ permission: 'allow' });
  process.exit(0);
}

const filePath = input.file_path || input.path || input.tool_input?.file_path || '';
const content = input.content || input.tool_input?.content || input.tool_input?.new_string || '';

const BLOCK_PATTERNS = [
  /-----BEGIN RSA PRIVATE KEY-----/,
  /-----BEGIN EC PRIVATE KEY-----/,
  /-----BEGIN OPENSSH PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
];

for (const re of BLOCK_PATTERNS) {
  if (re.test(content)) {
    writeJson({
      permission: 'deny',
      user_message: 'Blocked: possible secret or private key in file content.',
      agent_message: 'Do not commit secrets. Use env vars or gitignored config.',
    });
    process.exit(0);
  }
}

const normalised = String(filePath).replace(/\\/g, '/');
const isTestPath = /\/(examples?|tests?|__tests?__|fixtures?|mock|stub|spec)\//i.test(normalised);
if (!isTestPath && (/\.env(\..+)?$/.test(normalised) || /\.pem$/.test(normalised))) {
  writeJson({
    permission: 'deny',
    user_message: 'Blocked: writing to .env or .pem outside test/example dirs.',
    agent_message: 'Use gitignored local config or example template files.',
  });
  process.exit(0);
}

writeJson({ permission: 'allow' });
process.exit(0);
