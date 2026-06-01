#!/usr/bin/env node

/**
 * Demo script showing how to update HUD state for quota and agents
 */

import {
  updateQuota,
  updateAgents,
  incrementSpawnedAgent,
  incrementRunningAgent,
  completeRunningAgent
} from './state.mjs';

async function demo() {
  console.log("Demonstrating HUD state updates:\n");

  // Update quota information
  console.log("1. Updating quota...");
  await updateQuota(75, 50, 60, new Date(Date.now() + 7200000).toISOString(), 2, 0);
  console.log("   Quota updated: 75% session used, 50% weekly used, 60% weekly sonnet used, resets in 2 hours\n");

  // Update agent information
  console.log("2. Updating agent counts...");
  await updateAgents(5, 2, 3, ["coder", "reviewer", "debugger", "tester"]);
  console.log("   Agents updated: 5 spawned, 2 running, 3 completed, types: [coder,reviewer,debugger,tester]\n");

  // Increment spawned agent
  console.log("3. Incrementing spawned agent...");
  await incrementSpawnedAgent("executor");
  console.log("   Spawned agent count incremented, new type: executor\n");

  // Increment running agent
  console.log("4. Incrementing running agent...");
  await incrementRunningAgent();
  console.log("   Running agent count incremented\n");

  // Complete a running agent
  console.log("5. Completing a running agent...");
  await completeRunningAgent();
  console.log("   Completed a running agent (moved from running to completed)\n");

  console.log("State updates completed! The HUD will reflect these changes when rendered.");
}

demo().catch(console.error);