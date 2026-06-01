#!/usr/bin/env node
'use strict';

/**
 * Safe git hook installer for pre-commit quality checks
 * Preserves existing hooks while adding our quality check script
 */

import { existsSync, readFileSync, writeFileSync, chmodSync, copyFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const VENUS_HOOK_START = '# === VENUS_PRE_COMMIT_START ===';
const VENUS_HOOK_END = '# === VENUS_PRE_COMMIT_END ===';

function getGitHooksPath() {
  try {
    // Use git to resolve the correct hooks path, handling worktrees properly
    const hooksPath = execSync('git rev-parse --git-path hooks/pre-commit', { encoding: 'utf-8' }).trim();
    return hooksPath;
  } catch (error) {
    console.error('Not in a git repository or git command failed');
    process.exit(1);
  }
}

function getRepoRoot() {
  try {
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
    return repoRoot;
  } catch (error) {
    console.error('Could not determine git repository root');
    process.exit(1);
  }
}

function installHook() {
  const precommitHookPath = getGitHooksPath();
  const repoRoot = getRepoRoot();
  
  let existingHook = '';
  if (existsSync(precommitHookPath)) {
    existingHook = readFileSync(precommitHookPath, 'utf8');
    
    // Check if we already have a managed block and update only that part
    if (existingHook.includes(VENUS_HOOK_START) && existingHook.includes(VENUS_HOOK_END)) {
      // Replace the existing managed block
      const startIdx = existingHook.indexOf(VENUS_HOOK_START);
      const endIdx = existingHook.indexOf(VENUS_HOOK_END) + VENUS_HOOK_END.length;
      const beforeBlock = existingHook.substring(0, startIdx);
      const afterBlock = existingHook.substring(endIdx);
      
      const updatedHook = beforeBlock + generateVenusHookBlock(repoRoot) + afterBlock;
      writeFileSync(precommitHookPath, updatedHook);
      chmodSync(precommitHookPath, '755');
      
      console.log('✅ Existing pre-commit hook updated! (Venus managed block replaced)');
      return;
    }
    
    // Backup existing hook
    const backupPath = precommitHookPath + '.backup-' + Date.now();
    copyFileSync(precommitHookPath, backupPath);
    console.log(`⚠️  Existing pre-commit hook backed up to: ${backupPath}`);
    
    // Preserve existing hook and append our functionality
    const updatedHook = existingHook.trimEnd() + '\n\n' + generateVenusHookBlock(repoRoot);
    writeFileSync(precommitHookPath, updatedHook);
    chmodSync(precommitHookPath, '755');
    
    console.log('✅ Pre-commit hook updated! (Existing functionality preserved)');
  } else {
    // Create new hook file
    const hookContent = '#!/bin/sh\n' + generateVenusHookBlock(repoRoot);
    writeFileSync(precommitHookPath, hookContent);
    chmodSync(precommitHookPath, '755');
    
    console.log('✅ Pre-commit hook installed successfully!');
  }
  
  console.log('The hook will now run quality checks before each commit.');
}

function generateVenusHookBlock(repoRoot) {
  // Properly escape the repoRoot for shell usage (convert single quotes to '\'' pattern)
  const escapedRepoRoot = repoRoot.replace(/'/g, "'\\''");
  return `${VENUS_HOOK_START}
# Venus pre-commit quality checks
echo "Running pre-commit quality checks..."
cd '${escapedRepoRoot}' || exit 1
node scripts/hooks/pre-commit-check.js
exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "Pre-commit checks failed - commit aborted"
  exit $exit_code
fi
${VENUS_HOOK_END}`;
}

installHook();