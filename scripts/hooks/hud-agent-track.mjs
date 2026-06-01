#!/usr/bin/env node
/**
 * HUD Agent Tracking Hook — Updates HUD state when subagents start/stop.
 *
 * On START: increments spawned agent count and tracks agent type
 * On STOP: decrements running agent count and increments completed count
 *
 * Usage (settings.json):
 *   SubagentStart: node scripts/hooks/hud-agent-track.mjs start
 *   SubagentStop:  node scripts/hooks/hud-agent-track.mjs stop
 *
 * Always exits 0 — never blocks agent execution.
 */

import { incrementSpawnedAgent, completeRunningAgent } from '../hud/state.mjs';

const event = process.argv[2];

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', () => resolve(''));
    // Timeout if stdin does not have anything
    setTimeout(() => resolve(data.trim()), 500);
  });
}

function extractAgentType(payload) {
  try {
    const obj = JSON.parse(payload);

    // SubagentStart: tool_input may contain subagent_type and prompt
    const toolInput = obj.tool_input || obj.toolInput || {};
    const type = toolInput.subagent_type || toolInput.type || obj.subagent_type || '';

    return type ? type.replace(/^@/, '') : 'unknown'; // Remove @ prefix if present
  } catch {
    return 'unknown';
  }
}

async function main() {
  try {
    const payload = await readStdin();
    
    if (event === 'start') {
      const agentType = extractAgentType(payload);
      await incrementSpawnedAgent(agentType);
    } else if (event === 'stop') {
      await completeRunningAgent();
    }
  } catch (error) {
    // Silently ignore errors to avoid blocking agent execution
    console.error('HUD agent tracking error:', error.message);
  }
}

main().catch(() => {}).finally(() => process.exit(0));