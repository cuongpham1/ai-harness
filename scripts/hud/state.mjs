import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE_PATH = path.resolve(__dirname, '../../kg/runtime/hud-state.json');

let currentState = null;

export async function getState() {
  if (currentState === null) {
    try {
      const data = await fs.readFile(STATE_FILE_PATH, 'utf8');
      currentState = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return default state
        currentState = getDefaultState();
      } else {
        throw error;
      }
    }
  }
  return currentState;
}

export async function setState(newState) {
  currentState = { ...currentState, ...newState };
  await saveState();
}

export async function initializeState() {
  const state = await getState();
  return {
    ...state,
    save: saveState
  };
}

async function saveState() {
  if (currentState) {
    // Ensure the directory exists
    const dir = path.dirname(STATE_FILE_PATH);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
    
    await fs.writeFile(STATE_FILE_PATH, JSON.stringify(currentState, null, 2));
  }
}

function getDefaultState() {
  return {
    sessionStartTime: null,
    lastUpdated: new Date().toISOString(),
    quota: {
      sessionUsed: null,
      weeklyUsed: null,
      weeklySonnetUsed: null,
      resetAt: null,
      resetInHours: null,
      resetInMinutes: null
    },
    agents: {
      spawned: 0,
      running: 0,
      completed: 0,
      types: []
    }
  };
}

export async function updateLastUpdated() {
  const state = await getState();
  state.lastUpdated = new Date().toISOString();
  await saveState();
}

/**
 * Update quota information in state
 */
export async function updateQuota(sessionUsed, weeklyUsed, weeklySonnetUsed, resetAt, resetInHours, resetInMinutes) {
  const state = await getState();
  state.quota = {
    sessionUsed: sessionUsed,
    weeklyUsed: weeklyUsed,
    weeklySonnetUsed: weeklySonnetUsed,
    resetAt: resetAt,
    resetInHours: resetInHours,
    resetInMinutes: resetInMinutes
  };
  await saveState();
}

/**
 * Update agent tracking information in state
 */
export async function updateAgents(spawned, running, completed, types) {
  const state = await getState();
  state.agents = {
    spawned: spawned || state.agents.spawned,
    running: running || state.agents.running,
    completed: completed || state.agents.completed,
    types: types || state.agents.types
  };
  await saveState();
}

/**
 * Increment spawned agent count
 */
export async function incrementSpawnedAgent(agentType) {
  const state = await getState();
  state.agents.spawned = (state.agents.spawned || 0) + 1;
  if (agentType && !state.agents.types.includes(agentType)) {
    state.agents.types.push(agentType);
  }
  await saveState();
}

/**
 * Increment running agent count
 */
export async function incrementRunningAgent() {
  const state = await getState();
  state.agents.running = (state.agents.running || 0) + 1;
  await saveState();
}

/**
 * Decrement running agent count and increment completed
 */
export async function completeRunningAgent() {
  const state = await getState();
  state.agents.running = Math.max(0, (state.agents.running || 0) - 1);
  state.agents.completed = (state.agents.completed || 0) + 1;
  await saveState();
}
