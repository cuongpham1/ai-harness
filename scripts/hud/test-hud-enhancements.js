#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test data simulating input JSON with quota and agent information
const testData = {
  context_window: { used_percentage: 45.2 },
  model: "claude-3-sonnet",
  git: { branch: "main", status: "clean" },
  task: "Implement HUD enhancements",
  usage_limits: {
    session: {
      current_usage_percentage: 85,
      reset_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
    },
    weekly: {
      all_models: {
        current_usage_percentage: 15
      },
      sonnet_only: {
        current_usage_percentage: 21
      }
    }
  },
  cwd: "/Users/user/workspace/project"
};

// Test state data
const testState = {
  sessionStartTime: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  quota: {
    sessionUsed: 85,
    weeklyUsed: 15,
    weeklySonnetUsed: 21,
    resetAt: new Date(Date.now() + 3600000).toISOString(),
    resetInHours: 1,
    resetInMinutes: 0
  },
  agents: {
    spawned: 3,
    running: 1,
    completed: 2,
    types: ["coder", "reviewer", "debugger"]
  }
};

// Write test data to temporary file
const testInputFile = path.join(__dirname, 'test-input.json');
fs.writeFileSync(testInputFile, JSON.stringify(testData));

// Update the HUD state file
const stateDir = path.join(__dirname, '../../kg/runtime');
if (!fs.existsSync(stateDir)) {
  fs.mkdirSync(stateDir, { recursive: true });
}

const stateFile = path.join(stateDir, 'hud-state.json');
fs.writeFileSync(stateFile, JSON.stringify(testState, null, 2));

console.log("Testing HUD enhancements...\n");

// Run the HUD script with test data
const hudScript = path.join(__dirname, 'index.mjs');

const child = spawn('node', [hudScript], {
  stdio: ['pipe', 'inherit', 'inherit'],
  cwd: __dirname
});

// Send test data to stdin
child.stdin.write(JSON.stringify(testData));
child.stdin.end();

child.on('close', (code) => {
  console.log(`\nHUD test completed with exit code ${code}`);
  
  // Clean up test files
  try {
    fs.unlinkSync(testInputFile);
  } catch (e) {
    // Ignore cleanup errors
  }
  
  console.log("\nTest completed! The HUD should now display:");
  console.log("- Quota information: sess: 85% ! wk: 15% ✓ snt: 21% ⚠");
  console.log("- Agent information: agents: 1r/3/2c [coder,reviewer,debugger]");
});