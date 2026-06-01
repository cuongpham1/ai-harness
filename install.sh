#!/usr/bin/env bash
# AI Harness Installer
# Usage: bash install.sh /path/to/target/project

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-}"

# Validate
if [[ -z "$TARGET" ]]; then
  echo "Usage: bash install.sh /path/to/project"
  exit 1
fi

if [[ ! -d "$TARGET" ]]; then
  echo "Error: Target directory not found: $TARGET"
  exit 1
fi

echo ""
echo "=== AI Harness Installer ==="
echo "Target: $TARGET"
echo ""

# Detect upgrade mode
UPGRADE_MODE=false
if [[ -f "$TARGET/.claude/agents/pm.md" ]]; then
  echo "⚠ Existing harness detected at $TARGET"
  read -rp "Upgrade mode (skip existing files)? [Y/n]: " UPGRADE_ANS
  if [[ "${UPGRADE_ANS:-Y}" =~ ^[Yy]$ ]]; then
    UPGRADE_MODE=true
    echo "  Running in UPGRADE mode — existing files preserved"
  fi
fi

# Ask project type
echo "Project type?"
echo "  1) Flutter"
echo "  2) Generic (Node/Python/other)"
read -rp "Choose [1/2]: " PROJECT_TYPE

# Ask project name (for README/task template customization)
read -rp "Project name: " PROJECT_NAME

# Copy core files
echo ""
echo "Copying harness files..."

copy_dir() {
  local src="$HARNESS_DIR/$1"
  local dst="$TARGET/$1"
  if [[ -d "$src" ]]; then
    mkdir -p "$dst"
    if [[ "$UPGRADE_MODE" == "true" ]]; then
      # Copy only files not already present
      find "$src" -type f | while IFS= read -r f; do
        local rel="${f#$src/}"
        local dstf="$dst/$rel"
        if [[ -f "$dstf" ]]; then
          echo "  ~ $1/$rel (skipped, exists)"
        else
          mkdir -p "$(dirname "$dstf")"
          cp "$f" "$dstf"
          echo "  ✓ $1/$rel"
        fi
      done
    else
      cp -r "$src/." "$dst/"
      echo "  ✓ $1/"
    fi
  fi
}

copy_file() {
  local src="$HARNESS_DIR/$1"
  local dst="$TARGET/$1"
  local dst_dir="$TARGET/$(dirname "$1")"
  if [[ -f "$src" ]]; then
    if [[ "$UPGRADE_MODE" == "true" && -f "$dst" ]]; then
      echo "  ~ $1 (skipped, exists)"
      return
    fi
    mkdir -p "$dst_dir"
    cp "$src" "$TARGET/$1"
    echo "  ✓ $1"
  fi
}

copy_dir ".claude/agents"
copy_file ".claude/settings.json"
copy_dir "scripts/hooks"
copy_dir "scripts/utils"
copy_dir "scripts/hud"
copy_file "scripts/kg.js"
copy_file "scripts/trace-viewer.mjs"
copy_file "scripts/upgrade.sh"
copy_file "AGENTS.md"
copy_dir "docs"
copy_dir "benchmark"

# Flutter-specific
if [[ "$PROJECT_TYPE" == "1" ]]; then
  copy_file "scripts/rtk-flutter.sh"
  chmod +x "$TARGET/scripts/rtk-flutter.sh" 2>/dev/null || true
  echo "  ✓ scripts/rtk-flutter.sh (Flutter only)"
fi

# Create runtime dirs
mkdir -p "$TARGET/kg/runtime"
mkdir -p "$TARGET/kg/traces"
mkdir -p "$TARGET/.project-manager/tasks"
echo "  ✓ kg/runtime/ created"
echo "  ✓ kg/traces/ created"
echo "  ✓ .project-manager/tasks/ created"

# Write .project-manager/README.md from template
sed "s/PROJECT_NAME_PLACEHOLDER/$PROJECT_NAME/g" \
  "$HARNESS_DIR/.project-manager/README.md.template" \
  > "$TARGET/.project-manager/README.md" 2>/dev/null || \
  cp "$HARNESS_DIR/.project-manager/README.md.template" "$TARGET/.project-manager/README.md"
echo "  ✓ .project-manager/README.md"

# .gitignore additions
GITIGNORE="$TARGET/.gitignore"
ADDITIONS=(
  "kg/runtime/"
  "ai_test_results/"
  ".project-manager/tasks/*.md.bak"
  "kg/traces/"
  "benchmark/results/"
)
if [[ -f "$GITIGNORE" ]]; then
  echo "" >> "$GITIGNORE"
  echo "# AI Harness" >> "$GITIGNORE"
  for entry in "${ADDITIONS[@]}"; do
    if ! grep -qF "$entry" "$GITIGNORE"; then
      echo "$entry" >> "$GITIGNORE"
    fi
  done
  echo "  ✓ .gitignore updated"
fi

# Check Node.js
if ! command -v node &>/dev/null; then
  echo ""
  echo "⚠ Node.js not found — hooks require Node.js 18+"
fi

echo ""
echo "=== Done ==="
echo ""
echo "Next steps:"
echo "  1. cd $TARGET"
echo "  2. Open Claude Code: claude"
echo "  3. Harness auto-activates on session start"
echo ""
if [[ "$PROJECT_TYPE" == "1" ]]; then
echo "  Flutter commands:"
echo "    bash scripts/rtk-flutter.sh test      # filtered test output"
echo "    bash scripts/rtk-flutter.sh analyze   # filtered analyze"
echo ""
fi
echo "  Docs:"
echo "    docs/HARNESS.md       — how harness works"
echo "    docs/FEATURE_INTAKE.md — classify work"
echo "    docs/TEST_MATRIX.md   — proof requirements"
