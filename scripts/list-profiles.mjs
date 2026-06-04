#!/usr/bin/env node
/**
 * list-profiles.mjs — Show installed harness profiles from the manifest.
 *
 * Usage:
 *   node scripts/list-profiles.mjs          # pretty-print
 *   node scripts/list-profiles.mjs --json   # JSON output
 */

import { printProfiles } from './profile-manifest.mjs';

const jsonFlag = process.argv.includes('--json');
printProfiles(jsonFlag);
