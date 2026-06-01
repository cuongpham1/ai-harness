#!/usr/bin/env node
'use strict';

/**
 * Stop Hook — chỉ ghi checkpoint nhanh khi Claude dừng.
 *
 * Không ghi KG — PM agent quyết định khi nào và ghi gì (qua skill kg-memory.md).
 * Không ghi memory.md — PreCompact agent đọc KG và tạo memory.md.
 *
 * Always exits 0 — không bao giờ block session.
 */

process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('end', () => process.exit(0));
