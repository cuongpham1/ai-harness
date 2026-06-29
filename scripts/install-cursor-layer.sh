#!/usr/bin/env bash
# Install Cursor layer (hooks, rules, subagents) into target project.
# Usage: bash scripts/install-cursor-layer.sh [target_dir]

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-$HARNESS_DIR}"

echo ""
echo "Installing Cursor harness layer → $TARGET"

copy_if_new() {
  local rel="$1"
  local src="$HARNESS_DIR/$rel"
  local dst="$TARGET/$rel"
  if [[ ! -f "$src" ]]; then return; fi
  if [[ "$src" -ef "$dst" ]]; then return; fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "  ✓ $rel"
}

copy_dir_if_new() {
  local rel="$1"
  local src="$HARNESS_DIR/$rel"
  local dst="$TARGET/$rel"
  [[ -d "$src" ]] || return
  mkdir -p "$dst"
  find "$src" -type f | while read -r f; do
    local sub="${f#$src/}"
    mkdir -p "$(dirname "$dst/$sub")"
    [[ "$f" -ef "$dst/$sub" ]] && continue
    cp "$f" "$dst/$sub"
    echo "  ✓ $rel/$sub"
  done
}

copy_if_new ".cursor/hooks.json"
copy_dir_if_new ".cursor/rules"

# Cursor hooks reuse scripts/hooks/cursor (installed with main harness)
mkdir -p "$TARGET/scripts/hooks/cursor"
if [[ "$HARNESS_DIR/scripts/hooks/cursor" -ef "$TARGET/scripts/hooks/cursor" ]]; then
  echo "  ~ scripts/hooks/cursor/ (symlinked, skip)"
else
  cp -R "$HARNESS_DIR/scripts/hooks/cursor/." "$TARGET/scripts/hooks/cursor/"
  echo "  ✓ scripts/hooks/cursor/"
fi

# Subagents from .claude/agents
node "$HARNESS_DIR/scripts/sync-cursor-agents.mjs" "$TARGET"

# Ensure AGENTS.md mentions Cursor
bash "$HARNESS_DIR/scripts/merge-agents-md.sh" "$HARNESS_DIR" "$TARGET" 2>/dev/null || true

echo ""
echo "Cursor layer installed."
echo "  1. Open project in Cursor"
echo "  2. Settings → Hooks — verify hooks loaded (restart Cursor if needed)"
echo "  3. Use subagents: pm, coder, spec-reviewer, reviewer, tester"
echo "  See docs/CURSOR.md"
