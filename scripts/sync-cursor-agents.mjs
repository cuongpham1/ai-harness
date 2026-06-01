#!/usr/bin/env node
/**
 * Sync .claude/agents/*.md → .cursor/agents/*.md (Cursor subagent format).
 * Usage: node scripts/sync-cursor-agents.mjs [target_dir]
 */
import fs from 'fs';
import path from 'path';

const target = path.resolve(process.argv[2] || process.cwd());
// Always sync from the *target* project's .claude/agents (not installer's cwd).
const srcDir = path.join(target, '.claude/agents');
const dstDir = path.join(target, '.cursor/agents');

if (!fs.existsSync(srcDir)) {
  console.error('Missing .claude/agents');
  process.exit(1);
}

fs.mkdirSync(dstDir, { recursive: true });

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

function parseFrontmatter(text) {
  const m = text.match(FRONTMATTER);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2].trim() };
}

let count = 0;
for (const file of fs.readdirSync(srcDir).filter(f => f.endsWith('.md'))) {
  const raw = fs.readFileSync(path.join(srcDir, file), 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const name = meta.name || file.replace(/\.md$/, '');
  let description = meta.description || `Harness ${name} subagent.`;
  description = description.replace(/^["']|["']$/g, '');
  if (!/use proactively|mandatory|delegate/i.test(description)) {
    description += ' Use proactively when this role is needed in the harness pipeline.';
  }

  const out = `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;
  fs.writeFileSync(path.join(dstDir, file), out);
  count++;
  console.log(`  ✓ .cursor/agents/${file}`);
}

console.log(`Synced ${count} subagent(s) to ${dstDir}`);
