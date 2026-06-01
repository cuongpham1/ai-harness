#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Real Claude Code stdin format
const realTestData = {
  "context_window": { "used_percentage": 45.2 },
  "model": "claude-3-sonnet",
  "git": { "branch": "main", "status": "clean" },
  "task": "Testing real quota display",
  "usage_limits": {
    "session": {
      "current_usage_percentage": 3,
      "reset_at": "2026-04-14T15:30:00.000Z"
    },
    "weekly": {
      "all_models": {
        "current_usage_percentage": 15
      },
      "sonnet_only": {
        "current_usage_percentage": 21
      }
    }
  },
  "cwd": "/Users/user/workspace/project"
};

// Test state data with real values
const testState = {
  sessionStartTime: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  quota: {
    sessionUsed: 3,
    weeklyUsed: 15,
    weeklySonnetUsed: 21,
    resetAt: "2026-04-14T15:30:00.000Z",
    resetInHours: null,
    resetInMinutes: null
  },
  agents: {
    spawned: 2,
    running: 1,
    completed: 1,
    types: ["coder", "reviewer"]
  }
};

// Write test data to temporary file
const testInputFile = path.join(__dirname, 'test-input-real.json');
fs.writeFileSync(testInputFile, JSON.stringify(realTestData));

// Update the HUD state file
const stateDir = path.join(__dirname, '../../kg/runtime');
if (!fs.existsSync(stateDir)) {
  fs.mkdirSync(stateDir, { recursive: true });
}

const stateFile = path.join(stateDir, 'hud-state.json');
fs.writeFileSync(stateFile, JSON.stringify(testState, null, 2));

console.log("Testing HUD with real Claude Code stdin format...\n");

// Run the HUD script with test data
const hudScript = path.join(__dirname, 'index.mjs');

const child = spawn('node', [hudScript], {
  stdio: ['pipe', 'inherit', 'inherit'],
  cwd: __dirname
});

// Send test data to stdin
child.stdin.write(JSON.stringify(realTestData));
child.stdin.end();

child.on('close', (code) => {
  console.log(`\nHUD test completed with exit code ${code}`);
  
  // Clean up test files
  try {
    fs.unlinkSync(testInputFile);
  } catch (e) {
    // Ignore cleanup errors
  }
  
  console.log("\nExpected display with real quota data:");
  console.log("- sess: 3% ✓ (green - OK status)");
  console.log("- wk: 15% ✓ (green - OK status)");
  console.log("- sn: 21% ✓ (green - OK status)");
});