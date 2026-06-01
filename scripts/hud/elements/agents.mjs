/**
 * Sub-Agent Progress Element for HUD
 * Tracks spawned agents count and their status
 */

export async function getAgentsElement(inputJson, config, state) {
  // Check if agents information is available in state
  const agents = state.agents || {};
  
  if (!agents) {
    return null;
  }

  const { spawned = 0, running = 0, completed = 0, types = [] } = agents;
  
  if (spawned === 0 && running === 0 && completed === 0) {
    return null;
  }

  const color = config.colors.agents || config.colors.reset;
  const reset = config.colors.reset;
  const runningColor = config.colors.running || '\x1b[36m'; // cyan
  const completedColor = config.colors.completed || '\x1b[32m'; // green
  const spawnedColor = config.colors.spawned || '\x1b[33m'; // yellow

  // Build the agents display
  const parts = [];
  
  // Add spawned count
  if (spawned > 0) {
    parts.push(`${spawnedColor}${spawned}${reset}`);
  }
  
  // Add running count if different from spawned
  if (running > 0 && running !== spawned) {
    parts.unshift(`${runningColor}${running}${reset}r`);
  }
  
  // Add completed count if different from spawned
  if (completed > 0 && completed !== spawned) {
    parts.push(`${completedColor}${completed}${reset}c`);
  }
  
  if (parts.length === 0) {
    return null;
  }

  // Add types if available
  let typesDisplay = '';
  if (types.length > 0) {
    const uniqueTypes = [...new Set(types)].slice(0, 3); // Limit to 3 types for readability
    typesDisplay = ` [${uniqueTypes.join(',')}]`;
  }

  const agentsText = `${color}agents: ${parts.join('/')}${reset}${typesDisplay}`;
  
  return agentsText;
}