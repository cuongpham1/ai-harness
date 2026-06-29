#!/usr/bin/env bash
# AI Harness Symlink Installer
# Usage: bash link-install.sh [--yes] [--force] /path/to/target/project
#
# Options:
#   --yes     Non-interactive; skip confirmation prompt
#   --force   Reinstall framework profile even if already in manifest

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YES=0
FORCE=0
TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) YES=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help)
      cat <<'EOF'
AI Harness Symlink Installer
Usage: bash link-install.sh [--yes] [--force] /path/to/target/project

Options:
  --yes     Non-interactive; skip confirmation prompt
  --force   Reinstall framework profile even if already in manifest
EOF
      exit 0
      ;;
    --)
      shift; break ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      [[ -z "$TARGET" ]] || { echo "Only one target path allowed" >&2; exit 1; }
      TARGET="$1"
      shift
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "Usage: bash link-install.sh [--yes] /path/to/project"
  exit 1
fi

if [[ ! -d "$TARGET" ]]; then
  echo "Error: Target directory not found: $TARGET" >&2
  exit 1
fi

TARGET="$(cd "$TARGET" && pwd)"
TODAY="$(date +%Y%m%d-%H%M%S)"

echo ""
echo "=== AI Harness Symlink Installer ==="
echo "Harness : $HARNESS_DIR"
echo "Target  : $TARGET"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Bootstrap with install.sh if no harness present
# ---------------------------------------------------------------------------
if [[ ! -f "$TARGET/.claude/agents/pm.md" ]]; then
  echo "No harness detected — running install.sh first..."
  INSTALL_EXTRA_FLAGS=""
  [[ "$FORCE" -eq 1 ]] && INSTALL_EXTRA_FLAGS="--force"
  bash "$HARNESS_DIR/install.sh" --yes $INSTALL_EXTRA_FLAGS "$TARGET"
  echo ""
fi

# ---------------------------------------------------------------------------
# Shared items to symlink
# Dir symlinks (entire directory replaced with symlink to HARNESS_DIR counterpart)
# ---------------------------------------------------------------------------
DIR_LINKS=(
  ".claude/agents"
  "scripts/hooks"
  "scripts/hud"
  "scripts/utils"
)

# Single-file symlinks
FILE_LINKS=(
  ".claude/settings.json"
  "scripts/bin/harness-cli"
  "scripts/kg.js"
  "scripts/trace-viewer.mjs"
  "scripts/upgrade.sh"
  "scripts/README.md"
  "scripts/harness-cli-release-tag"
  "scripts/merge-agents-md.sh"
  "scripts/friction-by-component.mjs"
  "scripts/verify-h3.sh"
  "scripts/verify-h4.sh"
  "scripts/verify-story.sh"
  "scripts/batch-verify.sh"
  "scripts/check-agent-parity.mjs"
  "scripts/rtk-shell.sh"
  "scripts/rtk-node.sh"
  "scripts/rtk-python.sh"
  "scripts/install-harness.sh"
  "docs/HARNESS_VERIFICATION.md"
)

# .gitignore managed block entries (dirs get trailing slash in gitignore)
GITIGNORE_ENTRIES=(
  ".claude/agents"
  ".claude/settings.json"
  "scripts/hooks/"
  "scripts/hud/"
  "scripts/utils/"
  "scripts/bin/harness-cli"
  "scripts/kg.js"
  "scripts/trace-viewer.mjs"
  "scripts/upgrade.sh"
  "scripts/README.md"
  "scripts/harness-cli-release-tag"
  "scripts/merge-agents-md.sh"
  "scripts/friction-by-component.mjs"
  "scripts/verify-h3.sh"
  "scripts/verify-h4.sh"
  "scripts/verify-story.sh"
  "scripts/batch-verify.sh"
  "scripts/check-agent-parity.mjs"
  "scripts/rtk-shell.sh"
  "scripts/rtk-node.sh"
  "scripts/rtk-python.sh"
  "scripts/install-harness.sh"
  "docs/HARNESS_VERIFICATION.md"
  "kg/runtime/installed-profiles.json"
)

GITIGNORE_MARKER_START="# >>> ai-harness symlinks >>>"
GITIGNORE_MARKER_END="# <<< ai-harness symlinks <<<"

# ---------------------------------------------------------------------------
# Helper: true if path is a symlink whose resolved target is inside HARNESS_DIR
# ---------------------------------------------------------------------------
is_linked_to_harness() {
  local path="$1"
  [[ -L "$path" ]] || return 1
  local dest
  dest="$(readlink "$path")"
  # Make absolute if relative
  if [[ "$dest" != /* ]]; then
    dest="$(cd "$(dirname "$path")" && cd "$dest" 2>/dev/null && pwd)" || return 1
  fi
  [[ "$dest" == "$HARNESS_DIR"* ]]
}

# ---------------------------------------------------------------------------
# Plan display
# ---------------------------------------------------------------------------
linked=0
skipped=0
backed_up=0

plan_link() {
  local rel="$1"
  local src="$HARNESS_DIR/$rel"
  local dst="$TARGET/$rel"
  if [[ ! -e "$src" ]]; then
    echo "  ? $rel (not in harness, skipping)"
    return
  fi
  if is_linked_to_harness "$dst"; then
    echo "  = $rel (already linked — no change)"
  elif [[ -L "$dst" ]]; then
    echo "  ~ $rel → backup wrong symlink as ${rel}.bak-TIMESTAMP, then link"
  elif [[ -d "$dst" ]]; then
    echo "  ~ $rel → backup directory as ${rel}.bak-TIMESTAMP, then link"
  elif [[ -e "$dst" ]]; then
    echo "  ~ $rel → backup file as ${rel}.bak-TIMESTAMP, then link"
  else
    echo "  + $rel → link"
  fi
}

echo "Plan:"
for rel in "${DIR_LINKS[@]}"; do plan_link "$rel"; done
for rel in "${FILE_LINKS[@]}"; do plan_link "$rel"; done
echo ""

# ---------------------------------------------------------------------------
# Confirmation (skipped with --yes)
# ---------------------------------------------------------------------------
if [[ "$YES" -eq 0 ]]; then
  read -rp "Proceed? [Y/n]: " CONFIRM
  if [[ ! "${CONFIRM:-Y}" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
  echo ""
fi

# ---------------------------------------------------------------------------
# Apply: backup existing path then create absolute symlink
# ---------------------------------------------------------------------------
apply_link() {
  local rel="$1"
  local src="$HARNESS_DIR/$rel"
  local dst="$TARGET/$rel"
  local dst_dir
  dst_dir="$(dirname "$dst")"

  if [[ ! -e "$src" ]]; then
    return
  fi

  # Already correct symlink → skip (idempotent)
  if is_linked_to_harness "$dst"; then
    echo "  = $rel (skipped, already linked)"
    skipped=$((skipped + 1))
    return
  fi

  # Backup any existing file/dir/wrong-symlink
  if [[ -e "$dst" || -L "$dst" ]]; then
    local bak="${dst}.bak-${TODAY}"
    mv "$dst" "$bak"
    echo "  ~ backed up: $rel → ${rel}.bak-${TODAY}"
    backed_up=$((backed_up + 1))
  fi

  mkdir -p "$dst_dir"
  ln -s "$src" "$dst"
  echo "  + linked: $rel → $src"
  linked=$((linked + 1))
}

echo "Applying symlinks..."
for rel in "${DIR_LINKS[@]}"; do apply_link "$rel"; done
for rel in "${FILE_LINKS[@]}"; do apply_link "$rel"; done

# ---------------------------------------------------------------------------
# Update profile manifest for any installed framework profile
# ---------------------------------------------------------------------------
if command -v node &>/dev/null && [[ -f "$HARNESS_DIR/scripts/profile-manifest.mjs" ]]; then
  HARNESS_PROFILE_FILE="$TARGET/.harness-profile"
  if [[ -f "$HARNESS_PROFILE_FILE" ]]; then
    _framework="$(cat "$HARNESS_PROFILE_FILE")"
    if [[ -n "$_framework" && "$_framework" != "generic" ]]; then
      _fw_profile_json="$HARNESS_DIR/frameworks/$_framework/profile.json"

      # Generate the project-local verify profile if missing (backlog-A).
      # link-install never created .harness-verify.json, so symlink projects
      # were both undiscoverable (no marker) and gave verify-story no project
      # profile to read. Seed it from the framework profile; the user edits it.
      if [[ ! -f "$TARGET/.harness-verify.json" && -f "$_fw_profile_json" ]]; then
        cp "$_fw_profile_json" "$TARGET/.harness-verify.json"
        echo "  ✓ .harness-verify.json (seeded from $_framework profile)"
      fi

      # Resolve version and checksum for manifest registration
      _version="unknown"
      _checksum=""
      if [[ -f "$_fw_profile_json" ]]; then
        if command -v python3 &>/dev/null; then
          _version=$(python3 -c "import json; d=json.load(open('$_fw_profile_json')); print(d.get('version','unknown'))" 2>/dev/null || echo "unknown")
        fi
        if command -v shasum &>/dev/null; then
          _checksum=$(shasum -a 256 "$_fw_profile_json" 2>/dev/null | awk '{print $1}')
        elif command -v sha256sum &>/dev/null; then
          _checksum=$(sha256sum "$_fw_profile_json" 2>/dev/null | awk '{print $1}')
        fi
      fi

      # Check manifest — only call add when appropriate (fix: --force controls add)
      echo ""
      if node "$HARNESS_DIR/scripts/profile-manifest.mjs" check "$_framework" "$TARGET" 2>/dev/null; then
        # Exit 0 = already installed
        if [[ "$FORCE" -eq 0 ]]; then
          echo "  = manifest: $_framework already registered (use --force to update)"
        else
          echo "  --force: updating manifest entry for $_framework..."
          node "$HARNESS_DIR/scripts/profile-manifest.mjs" add "$_framework" "$TARGET" "symlink" "$_version" "$_checksum" 2>/dev/null \
            && echo "  ✓ manifest updated" \
            || echo "  ⚠ manifest update failed (non-fatal)"
        fi
      else
        # Exit non-0 = not installed (or error — either way, attempt add)
        node "$HARNESS_DIR/scripts/profile-manifest.mjs" add "$_framework" "$TARGET" "symlink" "$_version" "$_checksum" 2>/dev/null \
          && echo "  ✓ manifest: $_framework registered as symlink (kg/runtime/installed-profiles.json)" \
          || echo "  ⚠ manifest register failed (non-fatal)"
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# .gitignore managed block (marker-delimited, idempotent replace)
# ---------------------------------------------------------------------------
GITIGNORE="$TARGET/.gitignore"

build_gitignore_block() {
  echo "$GITIGNORE_MARKER_START"
  for entry in "${GITIGNORE_ENTRIES[@]}"; do
    echo "$entry"
  done
  echo "$GITIGNORE_MARKER_END"
}

echo ""

if [[ ! -f "$GITIGNORE" ]]; then
  printf '' > "$GITIGNORE"
  echo "  + .gitignore created"
fi

BLOCK_FILE="$(mktemp)"
build_gitignore_block > "$BLOCK_FILE"

# Replace existing marker block in a .gitignore file (no python3 required).
# Uses python3 when available; falls back to awk for portability.
# Both paths: replace existing block without duplication, append if absent.
replace_gitignore_block() {
  local gi_path="$1"
  local block_file="$2"
  local start_m="$3"
  local end_m="$4"

  if command -v python3 &>/dev/null; then
    python3 - "$gi_path" "$block_file" "$start_m" "$end_m" <<'PYEOF'
import sys, re, os
gi_path    = sys.argv[1]
block_path = sys.argv[2]
start_m    = sys.argv[3]
end_m      = sys.argv[4]
content    = open(gi_path, 'r', encoding='utf-8').read()
new_block  = open(block_path, 'r', encoding='utf-8').read().rstrip('\n')
pattern    = re.escape(start_m) + r'.*?' + re.escape(end_m)
replaced   = re.sub(pattern, new_block, content, flags=re.DOTALL)
tmp = gi_path + '.tmp'
open(tmp, 'w', encoding='utf-8').write(replaced)
os.replace(tmp, gi_path)
PYEOF
  else
    # awk fallback: stream through file; when inside the marker block, skip lines
    # until end marker, then emit the new block in its place.
    local tmp_gi
    tmp_gi="$(mktemp)"
    awk -v start_m="$start_m" -v end_m="$end_m" -v block_file="$block_file" '
      BEGIN { inside = 0; emitted = 0 }
      $0 == start_m {
        inside = 1
        if (!emitted) {
          while ((getline line < block_file) > 0) print line
          close(block_file)
          emitted = 1
        }
        next
      }
      inside && $0 == end_m { inside = 0; next }
      inside { next }
      { print }
    ' "$gi_path" > "$tmp_gi"
    mv "$tmp_gi" "$gi_path"
  fi
}

if grep -qF "$GITIGNORE_MARKER_START" "$GITIGNORE"; then
  replace_gitignore_block "$GITIGNORE" "$BLOCK_FILE" "$GITIGNORE_MARKER_START" "$GITIGNORE_MARKER_END"
  echo "  ~ .gitignore: symlink block replaced (idempotent)"
else
  # Append block
  printf '\n' >> "$GITIGNORE"
  cat "$BLOCK_FILE" >> "$GITIGNORE"
  echo "  + .gitignore: symlink block added"
fi

rm -f "$BLOCK_FILE"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Done ==="
echo "  Linked    : $linked"
echo "  Skipped   : $skipped (already linked)"
echo "  Backed up : $backed_up"
echo ""
