#!/usr/bin/env node
/**
 * Cursor preToolUse hook: context usage nudge (warn-only).
 * Never blocks tool calls; emits warnings to stderr when usage is high.
 */
import { readStdinJson, writeJson } from './lib.mjs';

function parsePct(value, fallback) {
    const raw = parseFloat(value);
    return Number.isFinite(raw) && raw > 0 && raw <= 100 ? raw : fallback;
}

function fmtTokens(n) {
    if (!Number.isFinite(n)) return null;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(Math.round(n));
}

function normalizeContext(input) {
    const source = input.context_window || input.contextWindow;
    if (!source || typeof source !== 'object') return null;

    const current = Number.parseFloat(source.current_tokens ?? source.currentTokens);
    const max = Number.parseFloat(source.max_tokens ?? source.maxTokens);

    let pct = Number.parseFloat(
        source.percent_used
        ?? source.percentUsed
        ?? source.used_percentage
    );

    if (!(Number.isFinite(pct) && pct >= 0)
        && Number.isFinite(current)
        && Number.isFinite(max)
        && max > 0) {
        pct = (current / max) * 100;
    }

    if (!(Number.isFinite(pct) && pct >= 0)) return null;

    return {
        pct,
        current: Number.isFinite(current) ? current : null,
        max: Number.isFinite(max) ? max : null,
    };
}

function tokenSuffix(ctx) {
    if (ctx.current == null || ctx.max == null) return '';
    return ` (${fmtTokens(ctx.current)}/${fmtTokens(ctx.max)} tokens)`;
}

const TIER1 = parsePct(process.env.CONTEXT_NUDGE_PCT_TIER1 ?? process.env.COMPACT_PCT_TIER1, 60);
const TIER2 = parsePct(process.env.CONTEXT_NUDGE_PCT_TIER2 ?? process.env.COMPACT_PCT_TIER2, 80);
const TIER3 = parsePct(process.env.CONTEXT_NUDGE_PCT_TIER3 ?? process.env.COMPACT_PCT_TIER3, 92);

const input = await readStdinJson();
const ctx = normalizeContext(input);

if (ctx) {
    const pctStr = ctx.pct.toFixed(1);
    const tok = tokenSuffix(ctx);
    if (ctx.pct >= TIER3) {
        process.stderr.write(
            `[context-nudge][critical] ${pctStr}% used${tok}. Finish current slice and start a fresh session soon.\n`
        );
    } else if (ctx.pct >= TIER2) {
        process.stderr.write(
            `[context-nudge][high] ${pctStr}% used${tok}. Keep next steps focused to avoid context drift.\n`
        );
    } else if (ctx.pct >= TIER1) {
        process.stderr.write(
            `[context-nudge][warn] ${pctStr}% used${tok}. Consider wrapping this phase after a checkpoint.\n`
        );
    }
}

writeJson({ permission: 'allow' });
process.exit(0);