#!/usr/bin/env bash
# Sync harness template updates into an installed target (solo-dev friendly).
# Does NOT modify .gitignore. Overwrites hook wiring and shared scripts.
#
# Usage: bash scripts/sync-harness-layer.sh /path/to/target

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:?usage: sync-harness-layer.sh /path/to/target}"

if [[ ! -d "$TARGET" ]]; then
  echo "Error: target not found: $TARGET" >&2
  exit 1
fi

echo ""
echo "Syncing harness layer → $TARGET"

copy_file() {
  local rel="$1"
  local src="$HARNESS_DIR/$rel"
  local dst="$TARGET/$rel"
  [[ -f "$src" ]] || return 0
  if [[ "$src" -ef "$dst" ]]; then
    echo "  ~ $rel (same file)"
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "  ✓ $rel"
}

copy_dir() {
  local rel="$1"
  local src="$HARNESS_DIR/$rel"
  local dst="$TARGET/$rel"
  [[ -d "$src" ]] || return 0
  if [[ "$src" -ef "$dst" ]]; then
    echo "  ~ $rel/ (symlinked, skip)"
    return 0
  fi
  mkdir -p "$dst"
  cp -R "$src/." "$dst/"
  echo "  ✓ $rel/"
}

# Cursor layer
copy_file ".cursor/hooks.json"
copy_dir ".cursor/rules"
copy_dir ".cursor/skills"
copy_dir "scripts/hooks/cursor"

# Shared hooks + utils touched by recent harness updates
SHARED=(
  scripts/utils/session-touched-tasks.js
  scripts/utils/atomic-write.js
  scripts/utils/kg-paths.js
  scripts/hooks/check-task-handoff.js
  scripts/hooks/session-start-pm.js
  scripts/hooks/update-pm-readme.js
  scripts/hooks/auto-checkpoint.js
  scripts/hooks/suggest-compact.js
  scripts/hooks/pre-agent-codegraph.mjs
  scripts/hooks/export-langfuse-trace.mjs
  scripts/hooks/sync-harness-trace.mjs
  scripts/hooks/score-trace-after-sync.mjs
  scripts/hooks/post-tool-task-tracker.js
  scripts/hooks/post-commit-archaeologist.js
  .github/copilot-instructions.md
  docs/CODEX.md
  docs/CURSOR.md
  docs/TOKEN_EFFICIENCY.md
  docs/README.md
  docs/TOOL_REGISTRY.md
  scripts/README.md
  scripts/sync-harness-layer.sh
  scripts/rebuild-harness-cli.sh
)

for rel in "${SHARED[@]}"; do
  copy_file "$rel"
done

# Stack doc: frameworks/<profile>/docs/*_STACK.md → docs/
if [[ -f "$TARGET/.harness-profile" ]]; then
  profile="$(tr -d '[:space:]' < "$TARGET/.harness-profile")"
  case "$profile" in
    xcode) profile="swift" ;; # legacy alias — no frameworks/xcode profile
  esac
  stack_name="$(printf '%s' "$profile" | tr '[:lower:]' '[:upper:]')_STACK.md"
  stack_src="$HARNESS_DIR/frameworks/$profile/docs/$stack_name"
  if [[ -f "$stack_src" ]]; then
    mkdir -p "$TARGET/docs"
    if [[ "$stack_src" -ef "$TARGET/docs/$stack_name" ]]; then
      echo "  ~ docs/$stack_name (same file)"
    else
      cp "$stack_src" "$TARGET/docs/$stack_name"
      echo "  ✓ docs/$stack_name (frameworks/$profile)"
    fi
  else
    echo "  ⚠ no stack doc for profile '$profile' (expected frameworks/$profile/docs/$stack_name)" >&2
  fi
  if [[ "$profile" == "swift" && -f "$HARNESS_DIR/frameworks/swift/scripts/rtk-swift.sh" ]]; then
    rtk_dst="$TARGET/scripts/rtk-swift.sh"
    rtk_src="$HARNESS_DIR/frameworks/swift/scripts/rtk-swift.sh"
    if [[ "$rtk_src" -ef "$rtk_dst" ]]; then
      echo "  ~ scripts/rtk-swift.sh (same file)"
    else
      mkdir -p "$TARGET/scripts"
      cp "$rtk_src" "$rtk_dst"
      chmod +x "$rtk_dst" 2>/dev/null || true
      echo "  ✓ scripts/rtk-swift.sh (frameworks/swift)"
    fi
  fi
fi

# Merge Claude hook entries without clobbering user settings
if [[ -f "$TARGET/.claude/settings.json" ]]; then
  node "$HARNESS_DIR/scripts/merge-settings-hooks.mjs" "$HARNESS_DIR" "$TARGET" || true
fi

# Agent parity
if [[ -f "$HARNESS_DIR/scripts/sync-cursor-agents.mjs" ]]; then
  node "$HARNESS_DIR/scripts/sync-cursor-agents.mjs" "$TARGET" || true
  echo "  ✓ .cursor/agents (synced from .claude/agents)"
fi

# Local git pre-commit (not tracked — safe for solo dev)
PRE_COMMIT_SRC="$HARNESS_DIR/scripts/hooks/git/pre-commit"
PRE_COMMIT_DST="$TARGET/.git/hooks/pre-commit"
if [[ -f "$PRE_COMMIT_SRC" && -d "$TARGET/.git" ]]; then
  cp "$PRE_COMMIT_SRC" "$PRE_COMMIT_DST"
  chmod +x "$PRE_COMMIT_DST"
  echo "  ✓ .git/hooks/pre-commit"
fi

# Refresh PM README from task file statuses
if [[ -d "$TARGET/.project-manager/tasks" ]]; then
  node "$TARGET/scripts/hooks/update-pm-readme.js" --refresh-all 2>/dev/null \
    && echo "  ✓ .project-manager/README.md refreshed" \
    || true
fi

echo ""
echo "Sync complete. Restart Cursor or save .cursor/hooks.json to reload hooks."
