#!/usr/bin/env node
import fs from 'fs';
import { renderStatusLine } from './render.mjs';
import { loadConfig } from './config.mjs';
import { initializeState } from './state.mjs';

async function main() {
  try {
    // Read JSON input from stdin
    const inputData = await readStdin();
    const inputJson = JSON.parse(inputData);
    
    // Load configuration and initialize state
    const config = loadConfig();
    const state = await initializeState();
    
    // Update session start time if not set
    if (!state.sessionStartTime) {
      state.sessionStartTime = new Date().toISOString();
      await state.save();
    }
    
    // Render the status line
    const statusLine = await renderStatusLine(inputJson, config, state);
    console.log(statusLine);
  } catch (error) {
    console.error('Error processing HUD:', error.message);
    process.exit(1);
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    
    process.stdin.on('end', () => {
      resolve(data);
    });
    
    process.stdin.on('error', reject);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}