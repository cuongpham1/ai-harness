#!/usr/bin/env node
/** Read JSON stdin for Cursor hooks. */
export function readStdinJson() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    process.stdin.on('error', () => resolve({}));
  });
}

export function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj));
}
