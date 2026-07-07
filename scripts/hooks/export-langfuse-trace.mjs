#!/usr/bin/env node
/**
 * Stop hook — optional Langfuse exporter for harness traces.
 *
 * Controlled by env:
 *   HARNESS_LANGFUSE_ENABLED=1
 *   HARNESS_LANGFUSE_HOST=https://cloud.langfuse.com (optional)
 *   HARNESS_LANGFUSE_PUBLIC_KEY=...
 *   HARNESS_LANGFUSE_SECRET_KEY=...
 *
 * Non-blocking: errors are written to stderr and exit code is always 0.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { execFileSync } from 'child_process';

const cwd = (() => {
    try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); }
})();

const enabled = process.env.HARNESS_LANGFUSE_ENABLED === '1';
if (!enabled) process.exit(0);

const host = (process.env.HARNESS_LANGFUSE_HOST || 'https://jp.cloud.langfuse.com').replace(/\/$/, '');
const publicKey = process.env.HARNESS_LANGFUSE_PUBLIC_KEY || 'pk-lf-2990a5e5-b611-4155-b356-0accf014cd03';
const secretKey = process.env.HARNESS_LANGFUSE_SECRET_KEY || 'sk-lf-370db411-9949-464a-92f0-2dafd47f7123';

const dbPath = path.join(cwd, 'harness.db');
const stateFile = path.join(cwd, 'kg', 'runtime', 'langfuse-export-state.json');
const endpoint = `${host}/api/public/ingestion`;

function safeExit() { process.exit(0); }

function log(msg) {
    process.stderr.write(`[export-langfuse-trace] ${msg}\n`);
}

function readJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function writeJson(filePath, payload) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function hasSqlite() {
    try {
        execFileSync('sqlite3', ['-version'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

function normalizeTimestamp(raw) {
    const text = String(raw || '').trim();
    if (!text) return new Date().toISOString();
    const candidate = text.includes('T') ? text : `${text.replace(' ', 'T')}Z`;
    const date = new Date(candidate);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
}

function intOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

function sqlEscape(value) {
    return String(value).replace(/'/g, "''");
}

function traceColumns() {
    try {
        const out = execFileSync('sqlite3', ['-noheader', dbPath, 'PRAGMA table_info(trace);'], {
            encoding: 'utf8',
            timeout: 8000,
            stdio: 'pipe',
        });
        const cols = new Set();
        for (const line of out.split('\n')) {
            if (!line.trim()) continue;
            const parts = line.split('|');
            if (parts[1]) cols.add(parts[1].trim());
        }
        return cols;
    } catch {
        return new Set();
    }
}

function queryRows(lastExportedId, includeLangfuseCols) {
    const laneCol = "COALESCE(i.risk_lane, 'unknown')";
    const traceIdCol = includeLangfuseCols ? "COALESCE(t.langfuse_trace_id, '') AS langfuse_trace_id," : '';

    const sql = `
SELECT
  t.id,
  t.created_at,
  ${laneCol} AS risk_lane,
  COALESCE(t.agent, '') AS agent,
  COALESCE(t.outcome, '') AS outcome,
  COALESCE(t.task_summary, '') AS task_summary,
  COALESCE(t.token_estimate, '') AS token_estimate,
  COALESCE(t.duration_seconds, '') AS duration_seconds,
  COALESCE(t.harness_friction, '') AS harness_friction,
  COALESCE(t.notes, '') AS notes,
  ${traceIdCol}
  COALESCE(t.story_id, '') AS story_id
FROM trace t
LEFT JOIN intake i ON i.id = t.intake_id
WHERE t.id > ${Math.max(0, Number(lastExportedId) || 0)}
ORDER BY t.id ASC
LIMIT 200;
`.trim();

    // Prefer JSON output when sqlite3 supports -json.
    try {
        const out = execFileSync('sqlite3', ['-json', dbPath, sql], {
            encoding: 'utf8',
            timeout: 12000,
            stdio: 'pipe',
        });
        const rows = JSON.parse(out || '[]');
        if (Array.isArray(rows)) return rows;
    } catch {
        // fallback below
    }

    const sep = '\x1f';
    const fallbackSql = `
SELECT
  t.id,
  COALESCE(t.created_at, ''),
  ${laneCol},
  REPLACE(REPLACE(COALESCE(t.agent, ''), char(10), ' '), char(31), ' '),
  REPLACE(REPLACE(COALESCE(t.outcome, ''), char(10), ' '), char(31), ' '),
  REPLACE(REPLACE(COALESCE(t.task_summary, ''), char(10), ' '), char(31), ' '),
  COALESCE(t.token_estimate, ''),
  COALESCE(t.duration_seconds, ''),
  REPLACE(REPLACE(COALESCE(t.harness_friction, ''), char(10), ' '), char(31), ' '),
  REPLACE(REPLACE(COALESCE(t.notes, ''), char(10), ' '), char(31), ' '),
  ${includeLangfuseCols ? "REPLACE(REPLACE(COALESCE(t.langfuse_trace_id, ''), char(10), ' '), char(31), ' ')," : "'' ,"}
  REPLACE(REPLACE(COALESCE(t.story_id, ''), char(10), ' '), char(31), ' ')
FROM trace t
LEFT JOIN intake i ON i.id = t.intake_id
WHERE t.id > ${Math.max(0, Number(lastExportedId) || 0)}
ORDER BY t.id ASC
LIMIT 200;
`.trim();

    try {
        const out = execFileSync('sqlite3', ['-separator', sep, '-noheader', dbPath, fallbackSql], {
            encoding: 'utf8',
            timeout: 12000,
            stdio: 'pipe',
        });
        return out
            .split('\n')
            .filter(Boolean)
            .map((line) => {
                const parts = line.split(sep);
                return {
                    id: intOrNull(parts[0]),
                    created_at: parts[1] || '',
                    risk_lane: parts[2] || 'unknown',
                    agent: parts[3] || '',
                    outcome: parts[4] || '',
                    task_summary: parts[5] || '',
                    token_estimate: intOrNull(parts[6]),
                    duration_seconds: intOrNull(parts[7]),
                    harness_friction: parts[8] || '',
                    notes: parts[9] || '',
                    langfuse_trace_id: parts[10] || '',
                    story_id: parts[11] || '',
                };
            })
            .filter((row) => Number.isFinite(row.id) && row.id > 0);
    } catch {
        return [];
    }
}

function makeEvents(row) {
    const traceId = row.langfuse_trace_id || `harness-trace-${row.id}`;
    const nowIso = new Date().toISOString();
    const startIso = normalizeTimestamp(row.created_at);
    const endIso = row.duration_seconds && row.duration_seconds > 0
        ? new Date(new Date(startIso).getTime() + (row.duration_seconds * 1000)).toISOString()
        : startIso;

    const metadata = {
        source: 'ai-harness',
        harnessTraceId: row.id,
        lane: row.risk_lane || 'unknown',
        storyId: row.story_id || null,
        friction: row.harness_friction || 'none',
        notes: row.notes || '',
    };

    const traceCreate = {
        id: `harness-trace-create-${row.id}`,
        type: 'trace-create',
        timestamp: nowIso,
        body: {
            id: traceId,
            timestamp: startIso,
            name: (row.task_summary || `harness-trace-${row.id}`).slice(0, 200),
            userId: row.agent || 'unknown',
            sessionId: `lane:${row.risk_lane || 'unknown'}`,
            metadata,
        },
    };

    const generationBody = {
        id: `harness-generation-${row.id}`,
        traceId,
        name: 'harness-task',
        startTime: startIso,
        endTime: endIso,
        model: 'harness/unknown',
        input: row.task_summary || '',
        output: row.outcome || '',
        metadata,
    };

    if (Number.isFinite(row.token_estimate) && row.token_estimate > 0) {
        generationBody.usage = {
            totalTokens: row.token_estimate,
        };
    }

    const generationCreate = {
        id: `harness-generation-create-${row.id}`,
        type: 'generation-create',
        timestamp: nowIso,
        body: generationBody,
    };

    return {
        traceId,
        events: [traceCreate, generationCreate],
    };
}

function sendBatch(batch) {
    const url = new URL(endpoint);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    const payload = JSON.stringify({ batch });

    return new Promise((resolve, reject) => {
        const req = transport.request({
            method: 'POST',
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            headers: {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
                authorization: `Basic ${auth}`,
            },
            timeout: 15000,
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
                if (ok) {
                    resolve({ statusCode: res.statusCode, body });
                } else {
                    reject(new Error(`HTTP ${res.statusCode || 0}: ${String(body || '').slice(0, 300)}`));
                }
            });
        });

        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function markRowExported(rowId, traceId, canWriteDb) {
    if (!canWriteDb) return;
    try {
        const sql = `UPDATE trace SET langfuse_trace_id='${sqlEscape(traceId)}', langfuse_exported_at=datetime('now') WHERE id=${rowId};`;
        execFileSync('sqlite3', [dbPath, sql], {
            encoding: 'utf8',
            timeout: 8000,
            stdio: 'pipe',
        });
    } catch {
        // Non-fatal: state file still prevents re-export loops.
    }
}

async function main() {
    if (!publicKey || !secretKey) {
        log('HARNESS_LANGFUSE_PUBLIC_KEY/HARNESS_LANGFUSE_SECRET_KEY missing; skipping export');
        safeExit();
    }

    if (!fs.existsSync(dbPath)) safeExit();
    if (!hasSqlite()) {
        log('sqlite3 not found; skipping export');
        safeExit();
    }

    const state = readJson(stateFile, {
        last_exported_trace_id: 0,
        last_attempt_at: null,
        last_success_at: null,
        last_error: null,
    });

    const cols = traceColumns();
    const hasLangfuseCols = cols.has('langfuse_trace_id') && cols.has('langfuse_exported_at');
    const rows = queryRows(state.last_exported_trace_id || 0, hasLangfuseCols);
    if (!rows.length) {
        writeJson(stateFile, {
            ...state,
            last_attempt_at: new Date().toISOString(),
            last_error: null,
        });
        safeExit();
    }

    let exported = 0;
    let lastId = state.last_exported_trace_id || 0;

    for (const raw of rows) {
        const row = {
            ...raw,
            id: intOrNull(raw.id),
            token_estimate: intOrNull(raw.token_estimate),
            duration_seconds: intOrNull(raw.duration_seconds),
            risk_lane: raw.risk_lane || 'unknown',
        };
        if (!Number.isFinite(row.id) || row.id <= 0) continue;

        const { traceId, events } = makeEvents(row);
        try {
            await sendBatch(events);
            markRowExported(row.id, traceId, hasLangfuseCols);
            exported += 1;
            lastId = row.id;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            writeJson(stateFile, {
                ...state,
                last_attempt_at: new Date().toISOString(),
                last_exported_trace_id: lastId,
                last_error: msg,
            });
            log(`export failed at trace #${row.id}: ${msg}`);
            safeExit();
        }
    }

    writeJson(stateFile, {
        ...state,
        last_attempt_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_exported_trace_id: lastId,
        last_error: null,
    });

    if (exported > 0) {
        log(`exported ${exported} trace(s) to Langfuse`);
    }

    safeExit();
}

main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    log(`unexpected error: ${msg}`);
    safeExit();
});
