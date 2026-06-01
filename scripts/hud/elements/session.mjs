import { formatDuration } from '../utils.mjs';

export async function getSessionElement(inputJson, config, state) {
  try {
    if (!state.sessionStartTime) {
      return null;
    }

    const startTime = new Date(state.sessionStartTime);
    const now = new Date();
    const durationMs = now - startTime;
    
    if (durationMs < 0) {
      return null;
    }

    const durationStr = formatDuration(durationMs);
    const color = config.colors.session;
    const reset = config.colors.reset;
    
    return `${color}sess: ${durationStr}${reset}`;
  } catch (error) {
    return null;
  }
}