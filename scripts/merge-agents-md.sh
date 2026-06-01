#!/usr/bin/env bash
# Merge AI Harness block into target AGENTS.md without overwriting project content.
# Usage: merge-agents-md.sh <harness_dir> <target_dir>

set -euo pipefail

HARNESS_DIR="${1:?harness_dir required}"
TARGET_DIR="${2:?target_dir required}"
TARGET="$TARGET_DIR/AGENTS.md"
BLOCK_FILE="$HARNESS_DIR/templates/AGENTS.harness-block.md"
STARTER="$HARNESS_DIR/templates/AGENTS.starter.md"

[[ -f "$BLOCK_FILE" ]] || { echo "Missing $BLOCK_FILE" >&2; exit 1; }

merge_block_into() {
  local file="$1"
  local tmp
  tmp="$(mktemp)"
  if grep -Fq "<!-- HARNESS:BEGIN -->" "$file" && grep -Fq "<!-- HARNESS:END -->" "$file"; then
    awk -v block_file="$BLOCK_FILE" '
      /<!-- HARNESS:BEGIN -->/ {
        while ((getline line < block_file) > 0) print line
        in_block = 1
        next
      }
      /<!-- HARNESS:END -->/ && in_block { in_block = 0; next }
      !in_block { print }
    ' "$file" > "$tmp"
  else
    { cat "$file"; printf '\n'; cat "$BLOCK_FILE"; } > "$tmp"
  fi
  mv "$tmp" "$file"
}

if [[ -f "$TARGET" ]]; then
  merge_block_into "$TARGET"
  echo "  ✓ AGENTS.md (harness block merged)"
elif [[ -f "$STARTER" ]]; then
  mkdir -p "$TARGET_DIR"
  cp "$STARTER" "$TARGET"
  echo "  ✓ AGENTS.md (created from starter template)"
else
  mkdir -p "$TARGET_DIR"
  cp "$BLOCK_FILE" "$TARGET"
  echo "  ✓ AGENTS.md (created with harness block only)"
fi
