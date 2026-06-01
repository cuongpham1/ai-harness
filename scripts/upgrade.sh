#!/usr/bin/env bash
# Smart upgrade script — copies new harness files into an existing project.
# Usage: bash scripts/upgrade.sh /path/to/project

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  echo "Usage: bash scripts/upgrade.sh /path/to/project"
  exit 1
fi

if [[ ! -d "$TARGET" ]]; then
  echo "Error: Target directory not found: $TARGET"
  exit 1
fi

# Detect existing harness
if [[ ! -f "$TARGET/.claude/agents/pm.md" ]]; then
  echo "Error: No existing harness detected at $TARGET (.claude/agents/pm.md missing)"
  echo "For a fresh install use: bash install.sh $TARGET"
  exit 1
fi

echo ""
echo "=== AI Harness Upgrade ==="
echo "Source : $HARNESS_DIR"
echo "Target : $TARGET"
echo ""

added=0
skipped=0

copy_if_new() {
  local rel="$1"
  local src="$HARNESS_DIR/$rel"
  local dst="$TARGET/$rel"
  if [[ ! -f "$src" ]]; then
    return
  fi
  if [[ -f "$dst" ]]; then
    echo "  ~ $rel (skipped, exists)"
    skipped=$((skipped + 1))
  else
    mkdir -p "$TARGET/$(dirname "$rel")"
    cp "$src" "$dst"
    echo "  + $rel"
    added=$((added + 1))
  fi
}

# New hook files
copy_if_new "scripts/hooks/trace-logger.mjs"
copy_if_new "scripts/hooks/content-guard.mjs"

# New util files
copy_if_new "scripts/utils/retry.js"
copy_if_new "scripts/utils/state-recovery.js"

# New scripts
copy_if_new "scripts/trace-viewer.mjs"

# Benchmark dir — copy task files and runner only if not present
copy_if_new "benchmark/run.sh"
copy_if_new "benchmark/README.md"
copy_if_new "benchmark/tasks/sample-01.json"

# Merge settings.json — add new hooks without overwriting existing
SETTINGS="$TARGET/.claude/settings.json"
if [[ -f "$SETTINGS" ]]; then
  echo ""
  echo "Merging hooks into $SETTINGS ..."
  node - "$SETTINGS" <<'NODEEOF'
const fs   = require('fs');
const path = require('path');

const settingsPath = process.argv[2];
let settings;
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (e) {
  process.stderr.write('  ! Could not parse settings.json: ' + e.message + '\n');
  process.exit(0);
}

if (!settings.hooks) settings.hooks = {};

// SubagentStart — trace-logger start
if (!settings.hooks.SubagentStart) settings.hooks.SubagentStart = [];
const hasTraceStart = settings.hooks.SubagentStart.some(
  h => JSON.stringify(h).includes('trace-logger.mjs')
);
if (!hasTraceStart) {
  settings.hooks.SubagentStart.push({
    hooks: [{ type: 'command', command: 'node scripts/hooks/trace-logger.mjs start' }]
  });
  process.stderr.write('  + SubagentStart: trace-logger.mjs start\n');
} else {
  process.stderr.write('  ~ SubagentStart: trace-logger already present\n');
}

// SubagentStop — trace-logger stop
if (!settings.hooks.SubagentStop) settings.hooks.SubagentStop = [];
const hasTraceStop = settings.hooks.SubagentStop.some(
  h => JSON.stringify(h).includes('trace-logger.mjs')
);
if (!hasTraceStop) {
  settings.hooks.SubagentStop.push({
    hooks: [{ type: 'command', command: 'node scripts/hooks/trace-logger.mjs stop' }]
  });
  process.stderr.write('  + SubagentStop: trace-logger.mjs stop\n');
} else {
  process.stderr.write('  ~ SubagentStop: trace-logger already present\n');
}

// PreToolUse — content-guard for Write and Edit
if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
const hasGuardWrite = settings.hooks.PreToolUse.some(
  h => h.matcher === 'Write' && JSON.stringify(h).includes('content-guard.mjs')
);
const hasGuardEdit = settings.hooks.PreToolUse.some(
  h => h.matcher === 'Edit' && JSON.stringify(h).includes('content-guard.mjs')
);

if (!hasGuardWrite) {
  settings.hooks.PreToolUse.push({
    matcher: 'Write',
    hooks: [{ type: 'command', command: 'node scripts/hooks/content-guard.mjs' }]
  });
  process.stderr.write('  + PreToolUse Write: content-guard.mjs\n');
} else {
  process.stderr.write('  ~ PreToolUse Write: content-guard already present\n');
}

if (!hasGuardEdit) {
  settings.hooks.PreToolUse.push({
    matcher: 'Edit',
    hooks: [{ type: 'command', command: 'node scripts/hooks/content-guard.mjs' }]
  });
  process.stderr.write('  + PreToolUse Edit: content-guard.mjs\n');
} else {
  process.stderr.write('  ~ PreToolUse Edit: content-guard already present\n');
}

// Atomic write
const tmp = settingsPath + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(settings, null, 4), 'utf8');
fs.renameSync(tmp, settingsPath);
process.stderr.write('  Settings saved.\n');
NODEEOF
fi

# .gitignore additions
GITIGNORE="$TARGET/.gitignore"
if [[ -f "$GITIGNORE" ]]; then
  changed_gi=false
  added=0
  for entry in "kg/traces/" "benchmark/results/"; do
    if ! grep -qF "$entry" "$GITIGNORE" 2>/dev/null; then
      if [[ $added -eq 0 ]]; then printf '\n' >> "$GITIGNORE"; fi
      echo "$entry" >> "$GITIGNORE"
      echo "  + .gitignore: $entry"
      ((added++)) || true
      changed_gi=true
    fi
  done
  if [[ "$changed_gi" == "false" ]]; then
    echo "  ~ .gitignore: entries already present"
  fi
fi

# Create kg/traces dir
mkdir -p "$TARGET/kg/traces"
echo "  + kg/traces/ ensured"

echo ""
echo "=== Upgrade complete ==="
echo "  Added   : $added file(s)"
echo "  Skipped : $skipped file(s) (already present)"
echo ""

exit 0
