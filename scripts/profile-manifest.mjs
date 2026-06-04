#!/usr/bin/env node
/**
 * profile-manifest.mjs — Shared utility for reading/writing the harness profile manifest.
 *
 * Manifest location: <harness-root>/kg/runtime/installed-profiles.json
 *
 * CLI usage (via node -e or direct invocation):
 *   node scripts/profile-manifest.mjs add <profileId> <targetDir> <mode> [version] [checksum]
 *   node scripts/profile-manifest.mjs remove <profileId> <targetDir>
 *   node scripts/profile-manifest.mjs check <profileId> <targetDir>   → exits 0 if installed, 1 if not
 *   node scripts/profile-manifest.mjs list [--json]
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Locate harness root by walking up from __dirname looking for .harness-verify.json
// or kg/runtime/
// ---------------------------------------------------------------------------
function findHarnessRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(join(dir, 'kg', 'runtime')) ||
      existsSync(join(dir, '.harness-verify.json'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume __dirname is scripts/ inside harness root
  return dirname(__dirname);
}

const HARNESS_ROOT = findHarnessRoot(__dirname);
const MANIFEST_DIR = join(HARNESS_ROOT, 'kg', 'runtime');
const MANIFEST_PATH = join(MANIFEST_DIR, 'installed-profiles.json');

// ---------------------------------------------------------------------------
// Low-level manifest read/write
// ---------------------------------------------------------------------------
function readManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return { updated: new Date().toISOString(), profiles: [] };
  }
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return { updated: new Date().toISOString(), profiles: [] };
  }
}

function writeManifest(manifest) {
  mkdirSync(MANIFEST_DIR, { recursive: true });
  manifest.updated = new Date().toISOString();
  const tmp = MANIFEST_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  renameSync(tmp, MANIFEST_PATH); // atomic on POSIX
}

// ---------------------------------------------------------------------------
// Normalize targetDir to absolute path
// ---------------------------------------------------------------------------
function normalizeTarget(targetDir) {
  return resolve(targetDir);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * addProfile — upsert a profile entry into the manifest.
 * @param {string} profileId  — framework id (e.g. "swift")
 * @param {string} targetDir  — absolute path to target project
 * @param {string} mode       — "copy" | "symlink"
 * @param {string} [version]  — from profile.json if available, else "unknown"
 * @param {string} [checksum] — sha256 of profile.json content
 */
export function addProfile(profileId, targetDir, mode, version = 'unknown', checksum = '') {
  const target = normalizeTarget(targetDir);
  const manifest = readManifest();

  const existing = manifest.profiles.find(
    (p) => p.profile_id === profileId && p.target_dir === target
  );

  const entry = {
    profile_id: profileId,
    installed_at: existing?.installed_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version,
    target_dir: target,
    install_mode: mode,
    checksum,
    status: 'installed',
  };

  if (existing) {
    Object.assign(existing, entry);
  } else {
    manifest.profiles.push(entry);
  }

  writeManifest(manifest);
}

/**
 * removeProfile — mark a profile entry as removed (soft delete).
 * @param {string} profileId
 * @param {string} targetDir
 */
export function removeProfile(profileId, targetDir) {
  const target = normalizeTarget(targetDir);
  const manifest = readManifest();

  const existing = manifest.profiles.find(
    (p) => p.profile_id === profileId && p.target_dir === target
  );

  if (existing) {
    existing.status = 'removed';
    existing.removed_at = new Date().toISOString();
    writeManifest(manifest);
    return true;
  }
  return false;
}

/**
 * isInstalled — returns true if the profile is installed (status=installed) for the given target.
 * @param {string} profileId
 * @param {string} targetDir
 * @returns {boolean}
 */
export function isInstalled(profileId, targetDir) {
  const target = normalizeTarget(targetDir);
  const manifest = readManifest();
  return manifest.profiles.some(
    (p) => p.profile_id === profileId && p.target_dir === target && p.status === 'installed'
  );
}

/**
 * listProfiles — returns all profile entries from the manifest.
 * @returns {Array}
 */
export function listProfiles() {
  return readManifest().profiles;
}

/**
 * printProfiles — pretty-prints installed profiles to stdout.
 * @param {boolean} [jsonOutput] — if true, print raw JSON
 */
export function printProfiles(jsonOutput = false) {
  const manifest = readManifest();

  if (jsonOutput) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  const profiles = manifest.profiles;
  if (profiles.length === 0) {
    console.log('No profiles installed.');
    return;
  }

  const active = profiles.filter((p) => p.status === 'installed');
  const removed = profiles.filter((p) => p.status === 'removed');

  console.log(`Profile Manifest  (updated: ${manifest.updated})`);
  console.log('');

  if (active.length > 0) {
    console.log('Installed:');
    for (const p of active) {
      console.log(`  ${p.profile_id}  v${p.version}  [${p.install_mode}]`);
      console.log(`    target   : ${p.target_dir}`);
      console.log(`    installed: ${p.installed_at}`);
      if (p.checksum) console.log(`    checksum : ${p.checksum}`);
    }
  }

  if (removed.length > 0) {
    console.log('');
    console.log('Removed:');
    for (const p of removed) {
      console.log(`  ${p.profile_id}  ${p.target_dir}  (removed: ${p.removed_at ?? 'unknown'})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: compute sha256 checksum of a file
// ---------------------------------------------------------------------------
export function checksumFile(filePath) {
  if (!existsSync(filePath)) return '';
  try {
    const content = readFileSync(filePath, 'utf8');
    return createHash('sha256').update(content, 'utf8').digest('hex');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Helper: read version from a profile.json file
// ---------------------------------------------------------------------------
export function readProfileVersion(profileJsonPath) {
  if (!existsSync(profileJsonPath)) return 'unknown';
  try {
    const data = JSON.parse(readFileSync(profileJsonPath, 'utf8'));
    return data.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// CLI entry point — only run when invoked directly (not imported)
// ---------------------------------------------------------------------------
const isMain = process.argv[1] &&
  (process.argv[1] === __filename ||
   process.argv[1].endsWith('/profile-manifest.mjs'));

if (!isMain) {
  // Imported as a module — do nothing in CLI block
} else {

const args = process.argv.slice(2);
const [command, ...rest] = args;

switch (command) {
  case 'add': {
    const [profileId, targetDir, mode, version, checksum] = rest;
    if (!profileId || !targetDir || !mode) {
      console.error('Usage: profile-manifest.mjs add <profileId> <targetDir> <mode> [version] [checksum]');
      process.exit(2);
    }
    addProfile(profileId, targetDir, mode, version, checksum);
    console.log(`Manifest updated: ${profileId} → ${normalizeTarget(targetDir)} [${mode}]`);
    break;
  }
  case 'remove': {
    const [profileId, targetDir] = rest;
    if (!profileId || !targetDir) {
      console.error('Usage: profile-manifest.mjs remove <profileId> <targetDir>');
      process.exit(2);
    }
    const ok = removeProfile(profileId, targetDir);
    if (ok) {
      console.log(`Manifest: ${profileId} marked as removed for ${normalizeTarget(targetDir)}`);
    } else {
      console.log(`Manifest: ${profileId} not found for ${normalizeTarget(targetDir)}`);
    }
    break;
  }
  case 'check': {
    const [profileId, targetDir] = rest;
    if (!profileId || !targetDir) {
      console.error('Usage: profile-manifest.mjs check <profileId> <targetDir>');
      process.exit(2);
    }
    const installed = isInstalled(profileId, targetDir);
    process.exit(installed ? 0 : 1);
  }
  case 'list': {
    const jsonFlag = rest.includes('--json');
    printProfiles(jsonFlag);
    break;
  }
  default:
    if (command) {
      console.error(`Unknown command: ${command}`);
      process.exit(2);
    }
    // No command: show help
    console.log('Usage: profile-manifest.mjs <add|remove|check|list> [args...]');
    break;
}

} // end isMain
