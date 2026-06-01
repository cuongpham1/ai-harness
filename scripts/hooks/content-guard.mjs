#!/usr/bin/env node
/**
 * PreToolUse hook — content guard for Write and Edit tools.
 *
 * BLOCK (exit 1): private keys, AWS secret keys, writing to .env/.pem outside test dirs
 * WARN (exit 0, stderr): generic credential assignments with real values
 *
 * Usage (settings.json PreToolUse):
 *   matcher: "Write" | "Edit"
 *   command: node scripts/hooks/content-guard.mjs
 */


function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(data.trim()), 500);
  });
}

// BLOCK patterns — private key headers, AWS secret key format
const BLOCK_PATTERNS = [
  { re: /-----BEGIN RSA PRIVATE KEY-----/, label: 'RSA private key' },
  { re: /-----BEGIN EC PRIVATE KEY-----/,  label: 'EC private key' },
  { re: /-----BEGIN OPENSSH PRIVATE KEY-----/, label: 'OpenSSH private key' },
  { re: /-----BEGIN DSA PRIVATE KEY-----/, label: 'DSA private key' },
  { re: /AKIA[0-9A-Z]{16}/, label: 'AWS access key ID' },
];

// File path BLOCK rules — .env or .pem outside examples/test dirs
function isBlockedPath(filePath) {
  if (!filePath) return false;
  const normalised = filePath.replace(/\\/g, '/');
  const isExampleOrTest = /\/(examples?|tests?|__tests?__|fixtures?|mock|stub|spec)\//i.test(normalised);
  if (isExampleOrTest) return false;
  return /\.env(\..+)?$/.test(normalised) || /\.pem$/.test(normalised);
}

// WARN patterns — credential key = value, but not placeholder values
const PLACEHOLDER_RE = /YOUR[_\-]?KEY|YOUR[_\-]?SECRET|YOUR[_\-]?TOKEN|PLACEHOLDER|EXAMPLE|CHANGEME|XXX|<.*?>/i;

const WARN_PATTERNS = [
  /\bpassword\s*=\s*["']?(?!\s*["']?\s*$)/gi,
  /\bsecret\s*=\s*["']?(?!\s*["']?\s*$)/gi,
  /\bapi_key\s*=\s*["']?(?!\s*["']?\s*$)/gi,
  /\btoken\s*=\s*["']?(?!\s*["']?\s*$)/gi,
];

function checkContent(content) {
  if (!content) return { block: null, warns: [] };

  for (const { re, label } of BLOCK_PATTERNS) {
    if (re.test(content)) {
      return { block: label, warns: [] };
    }
  }

  const warns = [];
  for (const re of WARN_PATTERNS) {
    for (const match of content.matchAll(re)) {
      const snippet = match[0];
      const afterEq = content.slice(match.index + snippet.length, match.index + snippet.length + 60);
      if (!PLACEHOLDER_RE.test(snippet + afterEq)) {
        warns.push(`Potential credential pattern: ${snippet.trim()}...`);
      }
    }
  }

  return { block: null, warns };
}

async function main() {
  const raw = await readStdin();

  let payload = {};
  try { payload = JSON.parse(raw); } catch { process.exit(0); }

  const toolName = payload.tool_name || payload.tool || '';
  const toolInput = payload.tool_input || payload.input || {};

  let content = '';
  let filePath = '';

  if (toolName === 'Write' || toolName === 'write') {
    filePath = toolInput.file_path || '';
    content  = toolInput.content || '';
  } else if (toolName === 'Edit' || toolName === 'edit') {
    filePath = toolInput.file_path || '';
    content  = toolInput.new_string || '';
  } else {
    // Unknown tool — just pass
    process.exit(0);
  }

  // Check file path block rule
  if (isBlockedPath(filePath)) {
    const msg = `Writing to ${filePath} is blocked outside of test/example directories`;
    process.stdout.write(JSON.stringify({ decision: 'block', reason: msg }) + '\n');
    process.exit(1);
  }

  const { block, warns } = checkContent(content);

  if (block) {
    const reason = `Blocked: content contains ${block}`;
    process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
    process.exit(1);
  }

  for (const w of warns) {
    process.stderr.write(`[content-guard] WARNING: ${w}\n`);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
