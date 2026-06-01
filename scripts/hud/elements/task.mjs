import fs from 'fs/promises';
import path from 'path';

export async function getTaskElement(inputJson, config) {
  try {
    const cwd = inputJson.workspace?.current_dir || inputJson.cwd || process.cwd();
    const runtimeDir = path.resolve(cwd, 'kg', 'runtime');
    const projectManagerDir = path.resolve(cwd, 'kg', 'runtime');
    
    // Check for active task in kg/runtime
    const inProgressFile = path.join(runtimeDir, 'in-progress.md');
    try {
      const content = await fs.readFile(inProgressFile, 'utf8');
      
      // Look for a task title in the file (first non-empty line or header)
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
          // Extract a short task description (first 50 chars)
          const taskDesc = trimmed.length > 50 ? trimmed.substring(0, 47) + '...' : trimmed;
          const color = config.colors.task;
          const reset = config.colors.reset;
          return `${color}task: ${taskDesc}${reset}`;
        }
      }
    } catch (e) {
      // File doesn't exist or can't be read, continue to legacy fallback
    }

    try {
      const legacyContent = await fs.readFile(path.join(projectManagerDir, 'tasks', 'in-progress.md'), 'utf8');
      const lines = legacyContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
          const taskDesc = trimmed.length > 50 ? trimmed.substring(0, 47) + '...' : trimmed;
          const color = config.colors.task;
          const reset = config.colors.reset;
          return `${color}task: ${taskDesc}${reset}`;
        }
      }
    } catch (e) {
      // Legacy file doesn't exist or can't be read, continue to next method
    }
    
    // Check for Linear integration
    // For now, we'll just check if there's a linear issue bound to the session
    // In a real implementation, this would integrate with the linear API
    
    return null;
  } catch (error) {
    return null;
  }
}
