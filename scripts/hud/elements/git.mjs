import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function getGitElement(inputJson, config) {
  try {
    const cwd = inputJson.workspace?.current_dir || inputJson.cwd || process.cwd();
    
    // Check if we're in a git repository
    const gitDir = path.resolve(cwd, '.git');
    if (!fs.existsSync(gitDir) && !execSync('git rev-parse --git-dir 2>/dev/null', { cwd }).toString().trim()) {
      return null;
    }

    // Get current branch
    let branch = '';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, stdio: ['pipe', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch (e) {
      branch = 'unknown';
    }

    // Get git status indicators
    let statusIndicator = '';
    try {
      const status = execSync('git status --porcelain', { cwd, stdio: ['pipe', 'pipe', 'ignore'] })
        .toString()
        .trim();

      if (status) {
        const lines = status.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          statusIndicator = ` (${lines.length})`;
        }
      }
    } catch (e) {
      // Ignore git status errors
    }

    const color = config.colors.git;
    const reset = config.colors.reset;
    return `${color}git: ${branch}${statusIndicator}${reset}`;
  } catch (error) {
    return null;
  }
}