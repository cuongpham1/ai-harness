#!/usr/bin/env node
/**
 * instinct-tracker.mjs — reads audit findings and friction data, upserts them
 * into kg/runtime/instincts.json with confidence scoring.
 *
 * Confidence formula:
 *   Math.min(1.0, (seen_count / 3) * severity_weight * recency_weight)
 *
 * severity_weight: high=1.0, medium=0.7, low=0.4
 * recency_weight: 1.0 if last_seen <= 7 days ago, decays 0.1 per additional
 *   week, min 0.3
 *
 * Status transitions:
 *   emerging  — confidence < 0.5
 *   stable    — 0.5 <= confidence < 0.75
 *   promoted  — confidence >= 0.75 AND seen_count >= 3
 *
 * Always exits 0. Errors go to stderr.
 */
import fs from 'fs';
import { renameSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();

const auditFile = path.join(cwd, 'kg', 'runtime', 'structural-audit-last.json');
const instinctsFile = path.join(cwd, 'kg', 'runtime', 'instincts.json');
const runtimeDir = path.join(cwd, 'kg', 'runtime');
const cliPath = path.join(cwd, 'scripts', 'bin', 'harness-cli');
const today = new Date().toISOString().slice(0, 10);

function log(...args) { process.stderr.write(args.join(' ') + '\n'); }

// ── Simple djb2 hash for stable IDs ──────────────────────────────────────────
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit integer
  }
  return hash.toString(16).padStart(8, '0');
}

function makeInstinctId(findingId, description) {
  if (findingId) return findingId;
  return `instinct-${djb2Hash(description)}`;
}

// ── Confidence calculation ────────────────────────────────────────────────────
const SEVERITY_WEIGHT = { high: 1.0, medium: 0.7, low: 0.4 };

function calcRecencyWeight(lastSeenDate) {
  const lastSeen = new Date(lastSeenDate).getTime();
  const now = Date.now();
  const daysAgo = (now - lastSeen) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 7) return 1.0;
  const extraWeeks = Math.floor((daysAgo - 7) / 7);
  return Math.max(0.3, 1.0 - extraWeeks * 0.1);
}

function calcConfidence(seenCount, severity, lastSeen) {
  const sw = SEVERITY_WEIGHT[severity] ?? 0.4;
  const rw = calcRecencyWeight(lastSeen);
  return Math.min(1.0, (seenCount / 3) * sw * rw);
}

function calcStatus(confidence, seenCount) {
  if (confidence >= 0.75 && seenCount >= 3) return 'promoted';
  if (confidence >= 0.5) return 'stable';
  return 'emerging';
}

// ── Load existing instincts ───────────────────────────────────────────────────
function loadInstincts() {
  if (!fs.existsSync(instinctsFile)) return { updated: today, instincts: [] };
  try {
    return JSON.parse(fs.readFileSync(instinctsFile, 'utf8'));
  } catch (err) {
    log(`[instinct-tracker] Failed to read instincts.json: ${err.message}`);
    return { updated: today, instincts: [] };
  }
}

// ── Load audit findings ───────────────────────────────────────────────────────
function loadAuditFindings() {
  if (!fs.existsSync(auditFile)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
    return data.findings || [];
  } catch (err) {
    log(`[instinct-tracker] Failed to read audit file: ${err.message}`);
    return [];
  }
}

// ── Load backlog items ────────────────────────────────────────────────────────
function loadBacklogItems() {
  if (!fs.existsSync(cliPath)) return [];
  const result = spawnSync(cliPath, ['query', 'backlog'], { cwd, encoding: 'utf8', timeout: 10000 });
  const raw = result.status === 0 ? result.stdout : '';
  if (!raw) return [];
  try {
    const lines = raw.trim().split('\n')
      .filter(l => l.trim() && !l.startsWith('id') && !l.startsWith('--'));
    return lines.map(l => {
      const parts = l.split('|').map(p => p.trim());
      return {
        id: parts[0],
        component: parts[1] || 'unknown',
        status: parts[2],
        description: parts[3] || '',
        severity: 'medium', // backlog items default to medium severity
      };
    }).filter(item => item.status === 'proposed' || item.status === 'accepted');
  } catch {
    return [];
  }
}

// ── Upsert a finding into instincts map ──────────────────────────────────────
function upsertInstinct(instinctMap, findingId, description, component, severity) {
  const instinctId = makeInstinctId(findingId, description);

  if (instinctMap.has(instinctId)) {
    const existing = instinctMap.get(instinctId);
    // Fix #3: check source_ids to avoid double-counting same audit run
    if (findingId && existing.source_ids.includes(findingId)) {
      // Same finding from the same audit file run — skip increment
      return false;
    }
    // Fix #5: save last_seen BEFORE mutating it so recency weight uses old date
    const prevLastSeen = existing.last_seen;
    existing.seen_count += 1;
    existing.last_seen = today;
    // Update severity if more severe finding found
    const existingWeight = SEVERITY_WEIGHT[existing.severity] ?? 0;
    const newWeight = SEVERITY_WEIGHT[severity] ?? 0;
    if (newWeight > existingWeight) existing.severity = severity;
    // Add source id if not already present
    if (findingId && !existing.source_ids.includes(findingId)) {
      existing.source_ids.push(findingId);
    }
    // Recalculate confidence and status using old last_seen for recency weight
    existing.confidence_score = parseFloat(
      calcConfidence(existing.seen_count, existing.severity, prevLastSeen).toFixed(4)
    );
    existing.status = calcStatus(existing.confidence_score, existing.seen_count);
    instinctMap.set(instinctId, existing);
    return true;
  } else {
    const confidence = parseFloat(
      calcConfidence(1, severity, today).toFixed(4)
    );
    instinctMap.set(instinctId, {
      id: instinctId,
      description,
      component: component || 'unknown',
      severity: severity || 'low',
      seen_count: 1,
      first_seen: today,
      last_seen: today,
      confidence_score: confidence,
      status: calcStatus(confidence, 1),
      source_ids: findingId ? [findingId] : [],
    });
    return true;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  // Fix #4: check audit file mtime — skip if unchanged since last run
  const auditMtime = fs.existsSync(auditFile) ? fs.statSync(auditFile).mtimeMs : 0;
  const data = loadInstincts();
  if (data.last_audit_mtime === auditMtime && auditMtime !== 0) {
    log('[instinct-tracker] Audit unchanged, skipping re-count');
    process.exit(0);
  }

  // Build map keyed by instinct id for fast lookup
  const instinctMap = new Map(data.instincts.map(i => [i.id, i]));

  const auditFindings = loadAuditFindings();
  const backlogItems = loadBacklogItems();

  log(`[instinct-tracker] audit findings: ${auditFindings.length}`);
  log(`[instinct-tracker] backlog items (proposed/accepted): ${backlogItems.length}`);

  let upsertCount = 0;

  for (const finding of auditFindings) {
    const description = finding.detail || finding.title || finding.id;
    if (upsertInstinct(instinctMap, finding.id, description, finding.component, finding.severity)) upsertCount++;
  }

  for (const item of backlogItems) {
    if (!item.description) continue;
    if (upsertInstinct(instinctMap, item.id, item.description, item.component, item.severity)) upsertCount++;
  }

  // Serialise back — store audit mtime so next run can skip if unchanged
  const updated = {
    updated: new Date().toISOString(),
    last_audit_mtime: auditMtime,
    instincts: Array.from(instinctMap.values()),
  };

  fs.mkdirSync(runtimeDir, { recursive: true });
  const tmp = instinctsFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  renameSync(tmp, instinctsFile);

  const promoted = updated.instincts.filter(i => i.status === 'promoted').length;
  const stable = updated.instincts.filter(i => i.status === 'stable').length;
  const emerging = updated.instincts.filter(i => i.status === 'emerging').length;

  log(`[instinct-tracker] done. upserted=${upsertCount} total=${updated.instincts.length} promoted=${promoted} stable=${stable} emerging=${emerging}`);
  process.exit(0);
}

main();
