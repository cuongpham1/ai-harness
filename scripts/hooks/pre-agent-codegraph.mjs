#!/usr/bin/env node
/**
 * PreToolUse hook — CodeGraph usage reminder for code-touching agents.
 *
 * Fires on Task tool invocations. If the agent is one of:
 *   coder, reviewer, explorer, spec-reviewer
 * appends a CodeGraph usage reminder block to the prompt.
 *
 * Hook I/O (Claude Code PreToolUse):
 *   stdin:  JSON with tool_name, tool_input fields
 *   stdout: JSON with decision + modifiedInput to modify the call,
 *           or empty/exit-0 to pass through unchanged.
 */

const CODEGRAPH_AGENTS = ['coder', 'reviewer', 'explorer', 'spec-reviewer'];

const CODEGRAPH_REMINDER = `

---
[CodeGraph] Before grepping or reading multiple files, use codegraph_explore or codegraph_search for faster lookup.
Before editing files, run codegraph_impact to check blast radius.
If you see a staleness warning in codegraph results, fall back to direct Read/Grep.
---`;

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);
    setTimeout(() => reject(new Error('stdin timeout')), 500);
  });
}

function isCodeTouchingAgent(toolInput) {
  const agentName = (toolInput.agent_name || '').toLowerCase().trim();
  return CODEGRAPH_AGENTS.includes(agentName);
}

async function main() {
  const raw = await readStdin();

  let payload = {};
  try { payload = JSON.parse(raw); } catch { process.exit(0); }

  const toolInput = payload.tool_input || payload.input || {};

  if (!isCodeTouchingAgent(toolInput)) {
    // Not a code-touching agent — pass through unchanged
    process.exit(0);
  }

  // Append CodeGraph reminder to the prompt
  const originalPrompt = toolInput.prompt || '';
  const modifiedInput = {
    ...toolInput,
    prompt: originalPrompt + CODEGRAPH_REMINDER,
  };

  process.stdout.write(JSON.stringify({
    decision: 'continue',
    modifiedInput,
  }) + '\n');

  process.exit(0);
}

main().catch(() => process.exit(0));
