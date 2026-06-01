#!/usr/bin/env node
'use strict';

/**
 * Pre-commit quality gate - runs type checking before allowing commit
 * Tests are skipped in pre-commit as they are too slow - run manually or in CI/CD
 * Non-interactive, fails fast on typecheck failure
 */


import { execSync } from 'child_process';
import { exit } from 'process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getRepoRoot() {
  // Resolve repo root from script location (two dirs up from scripts/hooks/)
  return join(__dirname, '..', '..');
}

function runCommand(command, description) {
  try {
    console.log(`Running ${description}: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: getRepoRoot() });
    console.log(`✓ ${description} passed`);
    return true;
  } catch (error) {
    console.error(`\n✗ ${description} failed`);
    return false;
  }
}

function main() {
  console.log('Pre-commit quality checks starting...');
  
  // Run type checking first (use the existing typecheck script)
  const typeCheckPassed = runCommand('npm run check', 'Type checking');
  if (!typeCheckPassed) {
    console.error('\n❌ Type checking failed - commit blocked');
    exit(1);
  }
  
    // Skip running full tests in pre-commit as they are too slow
  // Full tests should be run manually or in CI/CD
  // const testsPassed = runCommand('npm run test', 'Tests');
  // if (!testsPassed) {
  //   console.error('\n❌ Tests failed - commit blocked');
  //   exit(1);
  // }
  
  console.log('\n✅ Pre-commit type checking passed - continuing with commit');
  exit(0);
}

main();