/**
 * HUD Quota API - Fetch real usage from Anthropic OAuth API
 *
 * Fetches rate limit usage from Anthropic's OAuth API.
 * Based on OMC implementation but simplified to ~200 lines.
 *
 * Authentication:
 * - macOS: Reads from Keychain "Claude Code-credentials"
 * - Linux/fallback: Reads from ~/.claude/.credentials.json
 *
 * API: api.anthropic.com/api/oauth/usage
 * Response: { five_hour: { utilization }, seven_day: { utilization }, seven_day_sonnet: { utilization } }
 * Cache: kg/runtime/quota-cache.json (15s TTL for failures, 5min for success)
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { userInfo } from 'os';
import https from 'https';
import { homedir } from 'os';

const CACHE_TTL_SUCCESS_MS = 5 * 60 * 1000; // 5 minutes for successful fetches
const CACHE_TTL_FAILURE_MS = 15 * 1000; // 15 seconds for failures
const API_TIMEOUT_MS = 10000;
const CACHE_FILE = 'kg/runtime/quota-cache.json';

// Cache entry structure: { timestamp, data, error }
// OAuthCredentials structure: { accessToken, expiresAt, refreshToken }

/**
 * Get the Keychain service name for Claude Code credentials
 */
function getKeychainServiceName() {
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  if (configDir) {
    const hash = createHash('sha256').update(configDir).digest('hex').slice(0, 8);
    return `Claude Code-credentials-${hash}`;
  }
  return 'Claude Code-credentials';
}

/**
 * Read OAuth credentials from macOS Keychain
 */
function readKeychainCredentials() {
  if (process.platform !== 'darwin') return null;

  try {
    const serviceName = getKeychainServiceName();
    const result = execFileSync('/usr/bin/security', ['find-generic-password', '-s', serviceName, '-w'], {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!result) return null;

    const parsed = JSON.parse(result);
    const creds = parsed.claudeAiOauth || parsed;

    if (!creds.accessToken) return null;

    return {
      accessToken: creds.accessToken,
      expiresAt: creds.expiresAt,
      refreshToken: creds.refreshToken,
    };
  } catch {
    return null;
  }
}

/**
 * Read OAuth credentials from file fallback
 */
function readFileCredentials() {
  try {
    const credPath = join(homedir(), '.claude', '.credentials.json');
    if (!existsSync(credPath)) return null;

    const content = readFileSync(credPath, 'utf-8');
    const parsed = JSON.parse(content);

    const creds = parsed.claudeAiOauth || parsed;

    if (creds.accessToken) {
      return {
        accessToken: creds.accessToken,
        expiresAt: creds.expiresAt,
        refreshToken: creds.refreshToken,
      };
    }
  } catch {
    // File read failed
  }

  return null;
}

/**
 * Get OAuth credentials (Keychain first, then file fallback)
 */
function getCredentials() {
  const keychainCreds = readKeychainCredentials();
  if (keychainCreds) return keychainCreds;

  return readFileCredentials();
}

/**
 * Check if credentials are expired
 */
function isCredentialExpired(creds) {
  return creds.expiresAt != null && creds.expiresAt <= Date.now();
}

/**
 * Fetch usage from Anthropic API
 */
function fetchUsageFromApi(accessToken) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/api/oauth/usage',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'anthropic-beta': 'oauth-2025-04-20',
          'Content-Type': 'application/json',
        },
        timeout: API_TIMEOUT_MS,
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      }
    );

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

/**
 * Read cached quota data
 */
function readCache() {
  try {
    const cachePath = join(process.cwd(), CACHE_FILE);
    if (!existsSync(cachePath)) return null;

    const content = readFileSync(cachePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write quota data to cache
 */
function writeCache(entry) {
  try {
    const cachePath = join(process.cwd(), CACHE_FILE);
    const cacheDir = join(process.cwd(), 'kg', 'runtime');
    if (!existsSync(cacheDir)) {
      require('fs').mkdirSync(cacheDir, { recursive: true });
    }
    writeFileSync(cachePath, JSON.stringify(entry, null, 2));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Check if cache is still valid
 */
function isCacheValid(cache) {
  const age = Date.now() - cache.timestamp;
  const ttl = cache.error ? CACHE_TTL_FAILURE_MS : CACHE_TTL_SUCCESS_MS;
  return age < ttl;
}

/**
 * Get quota data (with caching)
 */
export async function getQuotaData() {
  const cache = readCache();
  if (cache && isCacheValid(cache)) {
    return cache.data;
  }

  const creds = getCredentials();
  if (!creds || isCredentialExpired(creds)) {
    writeCache({ timestamp: Date.now(), data: null, error: true });
    return null;
  }

  const data = await fetchUsageFromApi(creds.accessToken);
  writeCache({ timestamp: Date.now(), data, error: !data });
  return data;
}

/**
 * Convert API response to display format
 * Returns { session: utilization, weekly: utilization, sonnet: utilization }
 */
export async function getQuotaDisplayData() {
  const data = await getQuotaData();
  if (!data) return null;

  return {
    session: data.five_hour?.utilization || 0,
    weekly: data.seven_day?.utilization || 0,
    sonnet: data.seven_day_sonnet?.utilization || 0,
    resetAt: data.five_hour?.resets_at || data.seven_day?.resets_at || data.seven_day_sonnet?.resets_at
  };
}
