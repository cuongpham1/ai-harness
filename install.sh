#!/usr/bin/env bash
# AI Harness Installer
# Usage: bash install.sh [options] /path/to/target/project
#
# Options:
#   --yes                 Non-interactive (defaults: upgrade merge, auto-detect framework)
#   --framework <id>      Force framework (flutter, nodejs, java, ...)
#   --name <project>      Project name for .project-manager/README.md

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YES=0
FRAMEWORK_ARG=""
NAME_ARG=""
TARGET=""

# Allowlist framework ids (prevents path traversal via --framework)
is_valid_framework() {
  local id="$1"
  [[ -z "$id" || "$id" == "generic" ]] && return 0
  [[ "$id" =~ ^[a-z][a-z0-9_-]*$ ]] || return 1
  [[ -f "$HARNESS_DIR/frameworks/$id/profile.json" ]]
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) YES=1; shift ;;
    --framework) FRAMEWORK_ARG="${2:-}"; shift 2 ;;
    --name) NAME_ARG="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    --) shift; break ;;
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

if [[ $# -gt 0 ]]; then
  TARGET="${1:-$TARGET}"
fi

# Validate
if [[ -z "$TARGET" ]]; then
  echo "Usage: bash install.sh [--yes] [--framework id] [--name name] /path/to/project"
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
  if [[ "$YES" -eq 1 ]]; then
    UPGRADE_MODE=true
    echo "  Upgrade mode (existing harness — merge new files only)"
  else
    echo "⚠ Existing harness detected at $TARGET"
    read -rp "Upgrade mode (skip existing files)? [Y/n]: " UPGRADE_ANS
    if [[ "${UPGRADE_ANS:-Y}" =~ ^[Yy]$ ]]; then
      UPGRADE_MODE=true
      echo "  Running in UPGRADE mode — existing files preserved"
    fi
  fi
fi

# --- Framework Profile System ---

detect_framework() {
  local target="$1"
  local harness_dir="$2"
  local fw_root="$harness_dir/frameworks"
  [[ -d "$fw_root" ]] || return

  # Check nextjs/vue before generic react; java/csharp before nodejs
  local priority_order="nextjs vue flutter react java csharp rust go python nodejs php ruby"
  for fw in $priority_order; do
    local profile="$fw_root/$fw/profile.json"
    [[ -f "$profile" ]] || continue
    if command -v python3 &>/dev/null; then
      local detect_files
      detect_files=$(python3 -c "
import json, sys
try:
    d = json.load(open('$profile'))
    print('\n'.join(d.get('detect', [])))
except: pass
" 2>/dev/null)
    else
      # awk fallback: extract array values from "detect": [...]
      detect_files=$(awk '/"detect"/{found=1} found && /"[^"]+\./{gsub(/.*"([^"]+)".*/, "\\1"); print; if(/\]/) found=0}' "$profile" 2>/dev/null)
    fi
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      if [[ -f "$target/$f" ]]; then
        echo "$fw"
        return
      fi
    done <<< "$detect_files"
  done
  echo ""
}

select_framework() {
  local harness_dir="$1"
  local detected="$2"
  local fw_root="$harness_dir/frameworks"
  local frameworks=()

  for fw_dir in "$fw_root"/*/; do
    local fw
    fw=$(basename "$fw_dir")
    [[ "$fw" == "_schema" ]] && continue
    [[ -f "$fw_dir/profile.json" ]] && frameworks+=("$fw")
  done

  echo ""
  echo "Select framework:"
  local i=1
  local default_idx=$((${#frameworks[@]} + 1))
  for fw in "${frameworks[@]}"; do
    local display="$fw"
    if command -v python3 &>/dev/null; then
      display=$(python3 -c "
import json
try:
    d = json.load(open('$fw_root/$fw/profile.json'))
    print(d.get('display', '$fw'))
except: print('$fw')
" 2>/dev/null)
    fi
    if [[ "$fw" == "$detected" ]]; then
      echo "  $i) $display  ← auto-detected"
      default_idx=$i
    else
      echo "  $i) $display"
    fi
    ((i++))
  done
  echo "  $i) Generic (no framework)"

  if [[ "$YES" -eq 1 ]]; then
    choice=""
  else
    read -rp "Choose [$default_idx]: " choice
  fi
  local idx="${choice:-$default_idx}"

  if [[ "$idx" -ge 1 && "$idx" -le "${#frameworks[@]}" ]]; then
    echo "${frameworks[$((idx-1))]}"
  else
    echo "generic"
  fi
}

install_framework() {
  local framework="$1"
  local target="$2"
  local harness_dir="$3"

  [[ "$framework" == "generic" || -z "$framework" ]] && return

  local fw_dir="$harness_dir/frameworks/$framework"
  [[ -d "$fw_dir" ]] || { echo "  ⚠ Framework dir not found: $fw_dir"; return; }

  echo ""
  echo "Installing framework: $framework..."

  # Skills → .claude/skills/ (via skill installer)
  if [[ -f "$harness_dir/scripts/install-skills.sh" ]]; then
    bash "$harness_dir/scripts/install-skills.sh" "$framework" "$target"
  else
    # Fallback: direct copy
    if [[ -d "$fw_dir/skills" ]]; then
      mkdir -p "$target/.claude/skills"
      for f in "$fw_dir/skills/"*.md; do
        [[ -f "$f" ]] || continue
        cp "$f" "$target/.claude/skills/"
        echo "  ✓ .claude/skills/$(basename "$f")"
      done
    fi
  fi

  # Stack docs → docs/
  if [[ -d "$fw_dir/docs" ]]; then
    mkdir -p "$target/docs"
    for f in "$fw_dir/docs/"*.md; do
      [[ -f "$f" ]] || continue
      if [[ "$UPGRADE_MODE" == "true" && -f "$target/docs/$(basename "$f")" ]]; then
        echo "  ~ docs/$(basename "$f") (skipped, exists)"
      else
        cp "$f" "$target/docs/"
        echo "  ✓ docs/$(basename "$f")"
      fi
    done
  fi

  # Framework scripts
  if [[ -d "$fw_dir/scripts" ]]; then
    for f in "$fw_dir/scripts/"*; do
      [[ -f "$f" ]] || continue
      cp "$f" "$target/scripts/"
      chmod +x "$target/scripts/$(basename "$f")" 2>/dev/null || true
      echo "  ✓ scripts/$(basename "$f")"
    done
  fi

  # RTK wrappers per framework
  if [[ "$framework" == "flutter" && -f "$fw_dir/scripts/rtk-flutter.sh" ]]; then
    cp "$fw_dir/scripts/rtk-flutter.sh" "$target/scripts/rtk-flutter.sh"
    chmod +x "$target/scripts/rtk-flutter.sh" 2>/dev/null || true
    echo "  ✓ scripts/rtk-flutter.sh"
  fi
  if [[ "$framework" == "nodejs" || "$framework" == "react" || "$framework" == "nextjs" ]]; then
    for rtk in rtk-shell.sh rtk-node.sh; do
      if [[ -f "$harness_dir/scripts/$rtk" ]]; then
        cp "$harness_dir/scripts/$rtk" "$target/scripts/$rtk"
        chmod +x "$target/scripts/$rtk" 2>/dev/null || true
        echo "  ✓ scripts/$rtk"
      fi
    done
  fi
  if [[ "$framework" == "python" ]]; then
    for rtk in rtk-shell.sh rtk-python.sh; do
      if [[ -f "$harness_dir/scripts/$rtk" ]]; then
        cp "$harness_dir/scripts/$rtk" "$target/scripts/$rtk"
        chmod +x "$target/scripts/$rtk" 2>/dev/null || true
        echo "  ✓ scripts/$rtk"
      fi
    done
  fi

  # Inject agents-fragment.md → AGENTS.md
  local fragment="$fw_dir/agents-fragment.md"
  if [[ -f "$fragment" && -f "$target/AGENTS.md" ]]; then
    if ! grep -q "FRAMEWORK:BEGIN id=$framework" "$target/AGENTS.md"; then
      echo "" >> "$target/AGENTS.md"
      cat "$fragment" >> "$target/AGENTS.md"
      echo "  ✓ AGENTS.md (framework block injected)"
    else
      echo "  ~ AGENTS.md (framework block already present)"
    fi
  fi

  # Patch CONTEXT_RULES.md
  local ctx_patch="$fw_dir/context-rules-patch.md"
  if [[ -f "$ctx_patch" && -f "$target/docs/CONTEXT_RULES.md" ]]; then
    if ! grep -q "FRAMEWORK-RULES:BEGIN id=$framework" "$target/docs/CONTEXT_RULES.md"; then
      echo "" >> "$target/docs/CONTEXT_RULES.md"
      cat "$ctx_patch" >> "$target/docs/CONTEXT_RULES.md"
      echo "  ✓ docs/CONTEXT_RULES.md (framework rules appended)"
    else
      echo "  ~ docs/CONTEXT_RULES.md (framework rules already present)"
    fi
  fi

  # Copy profile for H4 verify-story (lint_cmd / test_cmd on target project)
  mkdir -p "$target/frameworks/$framework"
  if [[ -f "$fw_dir/profile.json" ]]; then
    cp "$fw_dir/profile.json" "$target/frameworks/$framework/profile.json"
    echo "  ✓ frameworks/$framework/profile.json (verify commands)"
  fi

  # Write .harness-profile
  echo "$framework" > "$target/.harness-profile"
  echo "  ✓ .harness-profile ($framework)"

  # Suggest MCP servers
  if [[ -f "$fw_dir/profile.json" ]] && command -v python3 &>/dev/null; then
    local mcp_info
    mcp_info=$(python3 -c "
import json
try:
    d = json.load(open('$fw_dir/profile.json'))
    servers = d.get('mcp_servers', [])
    if servers:
        print()
        print('  Recommended MCP servers:')
        for s in servers:
            req = '(required)' if s.get('required') else '(optional)'
            print(f\"    → {s['name']} {req}: {s['purpose']}\")
            print(f\"      Install: {s['install_cmd']}\")
except: pass
" 2>/dev/null)
    if [[ -n "$mcp_info" ]]; then
      echo "$mcp_info"
    fi
  fi
}

# Detect and select framework
DETECTED_FRAMEWORK=$(detect_framework "$TARGET" "$HARNESS_DIR")
if [[ -n "$DETECTED_FRAMEWORK" ]]; then
  echo "  Auto-detected: $DETECTED_FRAMEWORK"
fi
if [[ -n "$FRAMEWORK_ARG" ]]; then
  if ! is_valid_framework "$FRAMEWORK_ARG"; then
    echo "Error: invalid --framework '$FRAMEWORK_ARG' (no frameworks/$FRAMEWORK_ARG/profile.json)" >&2
    exit 1
  fi
  FRAMEWORK="$FRAMEWORK_ARG"
  echo "  Framework (forced): $FRAMEWORK"
else
  FRAMEWORK=$(select_framework "$HARNESS_DIR" "$DETECTED_FRAMEWORK")
fi

if [[ -n "$NAME_ARG" ]]; then
  PROJECT_NAME="$NAME_ARG"
elif [[ "$YES" -eq 1 ]]; then
  PROJECT_NAME="$(basename "$TARGET")"
else
  read -rp "Project name [$(basename "$TARGET")]: " PROJECT_NAME
  PROJECT_NAME="${PROJECT_NAME:-$(basename "$TARGET")}"
fi

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

# Upgrade: replace policy docs that still say CLI/DB are "optional later"
refresh_stale_policy_docs() {
  local rel src dst
  for rel in docs/HARNESS.md docs/HARNESS_MATURITY.md; do
    src="$HARNESS_DIR/$rel"
    dst="$TARGET/$rel"
    [[ -f "$src" ]] || continue
    if [[ ! -f "$dst" ]] \
      || grep -qE 'optional later|What we did not install from harness' "$dst" 2>/dev/null; then
      mkdir -p "$(dirname "$dst")"
      cp "$src" "$dst"
      echo "  ✓ $rel (refreshed — outdated harness policy)"
    fi
  done
}

# Upgrade: always refresh hook/verify scripts (behavior fixes without overwriting whole tree)
refresh_critical_scripts() {
  local rel src dst
  for rel in \
    scripts/verify-story.sh \
    scripts/verify-h4.sh \
    scripts/check-agent-parity.mjs \
    scripts/sync-cursor-agents.mjs \
    scripts/hooks/sync-harness-story.mjs \
    scripts/hooks/lib-harness-task.mjs \
    scripts/hooks/update-pm-readme.js \
    scripts/hooks/session-start-pm.js \
    scripts/hooks/run-harness-verify.mjs; do
    src="$HARNESS_DIR/$rel"
    dst="$TARGET/$rel"
    [[ -f "$src" ]] || continue
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    [[ "$rel" == *.sh ]] && chmod +x "$dst"
    echo "  ✓ $rel (refresh)"
  done
}

copy_dir ".claude/agents"
copy_file ".claude/settings.json"
copy_dir "scripts/hooks"
copy_dir "scripts/utils"
copy_dir "scripts/hud"
copy_file "scripts/kg.js"
copy_file "scripts/trace-viewer.mjs"
copy_file "scripts/upgrade.sh"
copy_file "scripts/README.md"
copy_file "scripts/harness-cli-release-tag"
copy_file "scripts/merge-agents-md.sh"
copy_file "scripts/friction-by-component.mjs"
copy_file "scripts/verify-h3.sh"
copy_file "scripts/verify-h4.sh"
copy_file "scripts/verify-story.sh"
copy_file "scripts/check-agent-parity.mjs"
copy_file "docs/HARNESS_VERIFICATION.md"
copy_file "scripts/rtk-shell.sh"
copy_file "scripts/rtk-node.sh"
copy_file "scripts/rtk-python.sh"
copy_file "scripts/install-harness.sh"
copy_dir "scripts/schema"
copy_dir "templates"
copy_dir "docs"
copy_dir "benchmark"
chmod +x "$TARGET/scripts/merge-agents-md.sh" 2>/dev/null || true
chmod +x "$TARGET/scripts/verify-h3.sh" 2>/dev/null || true
chmod +x "$TARGET/scripts/verify-h4.sh" 2>/dev/null || true
chmod +x "$TARGET/scripts/verify-story.sh" 2>/dev/null || true
chmod +x "$TARGET/scripts/rtk-shell.sh" 2>/dev/null || true
chmod +x "$TARGET/scripts/rtk-node.sh" 2>/dev/null || true
chmod +x "$TARGET/scripts/rtk-python.sh" 2>/dev/null || true
chmod +x "$TARGET/scripts/install-harness.sh" 2>/dev/null || true

# AGENTS.md — merge harness block, never blind overwrite
bash "$HARNESS_DIR/scripts/merge-agents-md.sh" "$HARNESS_DIR" "$TARGET"

if [[ "$UPGRADE_MODE" == "true" ]]; then
  refresh_stale_policy_docs
  refresh_critical_scripts
fi

# Harness CLI (durable layer)
sha256_file() {
  local file="$1"
  if command -v shasum &>/dev/null; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif command -v sha256sum &>/dev/null; then
    sha256sum "$file" | awk '{print $1}'
  else
    echo ""
  fi
}

build_harness_cli_from_source() {
  local cli_dst="$1"
  if ! command -v cargo &>/dev/null || [[ ! -f "$HARNESS_DIR/Cargo.toml" ]]; then
    return 1
  fi
  echo "  Building harness-cli from source (cargo)..."
  (cd "$HARNESS_DIR" && cargo build --release -q) || return 1
  local built="$HARNESS_DIR/target/release/harness-cli"
  [[ -x "$built" ]] || return 1
  cp "$built" "$cli_dst"
  chmod +x "$cli_dst"
  echo "  ✓ scripts/bin/harness-cli (built from source)"
  return 0
}

install_harness_cli() {
  local cli_dst="$TARGET/scripts/bin/harness-cli"
  mkdir -p "$TARGET/scripts/bin"

  if [[ -x "$HARNESS_DIR/scripts/bin/harness-cli" ]]; then
    cp "$HARNESS_DIR/scripts/bin/harness-cli" "$cli_dst"
    chmod +x "$cli_dst"
    echo "  ✓ scripts/bin/harness-cli (copied from installer)"
    return
  fi

  local tag
  tag="$(cat "$HARNESS_DIR/scripts/harness-cli-release-tag" 2>/dev/null || echo harness-cli-v0.1.7)"
  local arch platform os_name
  arch="$(uname -m)"
  os_name="$(uname -s)"
  case "$os_name" in
    Darwin) [[ "$arch" == "arm64" ]] && platform="macos-arm64" || platform="macos-x64" ;;
    Linux)  [[ "$arch" == "aarch64" || "$arch" == "arm64" ]] && platform="linux-arm64" || platform="linux-x64" ;;
    *)
      echo "  ⚠ Unsupported OS for harness-cli download: $os_name ($arch)" >&2
      echo "    Supported: macOS (arm64/x64), Linux (x64/arm64). Try: cargo build --release in installer repo." >&2
      build_harness_cli_from_source "$cli_dst" && return
      return
      ;;
  esac
  local base="https://github.com/hoangnb24/harness-experimental/releases/download/${tag}"
  if command -v curl &>/dev/null; then
    if curl -fsSL "$base/harness-cli-${platform}" -o "$cli_dst" \
      && curl -fsSL "$base/harness-cli-${platform}.sha256" -o /tmp/harness-cli.sha256.$$; then
      local expected actual
      expected="$(awk '{print $1}' /tmp/harness-cli.sha256.$$)"
      actual="$(sha256_file "$cli_dst")"
      rm -f /tmp/harness-cli.sha256.$$
      if [[ -z "$actual" ]]; then
        echo "  ⚠ shasum/sha256sum not found — cannot verify download" >&2
        rm -f "$cli_dst"
      elif [[ -n "$expected" && "$expected" == "$actual" ]]; then
        chmod +x "$cli_dst"
        echo "  ✓ scripts/bin/harness-cli (downloaded $tag, checksum OK)"
        return
      fi
      rm -f "$cli_dst"
      echo "  ⚠ harness-cli checksum mismatch for $tag ($platform)" >&2
    else
      echo "  ⚠ harness-cli download failed ($tag / $platform)" >&2
    fi
  else
    echo "  ⚠ curl not found — cannot download harness-cli" >&2
  fi
  build_harness_cli_from_source "$cli_dst" || echo "  ⚠ harness-cli not installed (download/build failed)" >&2
}

echo ""
echo "Installing Harness CLI..."
install_harness_cli

if [[ -x "$TARGET/scripts/bin/harness-cli" ]]; then
  (cd "$TARGET" && scripts/bin/harness-cli init) && echo "  ✓ harness.db initialized"
  (cd "$TARGET" && scripts/bin/harness-cli migrate 2>/dev/null) && echo "  ✓ harness.db migrations applied" || true
  (cd "$TARGET" && scripts/bin/harness-cli import brownfield 2>/dev/null) && echo "  ✓ harness.db seeded from docs (brownfield import)" || true
fi

# Framework-specific installation
install_framework "$FRAMEWORK" "$TARGET" "$HARNESS_DIR"

# Cursor layer (hooks, rules, subagents)
echo ""
echo "Installing Cursor layer..."
bash "$HARNESS_DIR/scripts/install-cursor-layer.sh" "$TARGET"

echo ""
echo "Agent parity (.claude ↔ .cursor)..."
if ! (cd "$TARGET" && node scripts/check-agent-parity.mjs); then
  echo "  ⚠ Drift detected — re-syncing .cursor from target .claude/agents"
  node "$HARNESS_DIR/scripts/sync-cursor-agents.mjs" "$TARGET"
  (cd "$TARGET" && node scripts/check-agent-parity.mjs) \
    && echo "  ✓ Agent parity OK after sync" \
    || echo "  ⚠ Agent parity still failing — review .claude vs .cursor manually"
else
  echo "  ✓ Agent parity OK"
fi

# Create runtime dirs
mkdir -p "$TARGET/kg/runtime"
mkdir -p "$TARGET/kg/traces"
mkdir -p "$TARGET/.project-manager/tasks"
echo "  ✓ kg/runtime/ created"
echo "  ✓ kg/traces/ created"
echo "  ✓ .project-manager/tasks/ created"

# Write .project-manager/README.md from template (safe replace — no sed injection)
if command -v python3 &>/dev/null; then
  python3 -c "
from pathlib import Path
import sys
src = Path(sys.argv[1])
dst = Path(sys.argv[2])
name = sys.argv[3]
dst.write_text(src.read_text(encoding='utf-8').replace('PROJECT_NAME_PLACEHOLDER', name), encoding='utf-8')
" "$HARNESS_DIR/.project-manager/README.md.template" "$TARGET/.project-manager/README.md" "$PROJECT_NAME"
else
  cp "$HARNESS_DIR/.project-manager/README.md.template" "$TARGET/.project-manager/README.md"
fi
echo "  ✓ .project-manager/README.md"

# .gitignore additions
GITIGNORE="$TARGET/.gitignore"
ADDITIONS=(
  "kg/runtime/"
  ".project-manager/tasks/*.md.bak"
  "kg/traces/"
  "benchmark/results/"
  "harness.db"
  "harness.db-wal"
  "harness.db-shm"
  "scripts/bin/harness-cli"
  ".harness-profile"
)
if [[ ! -f "$GITIGNORE" ]]; then
  cat > "$GITIGNORE" <<'EOF'
# AI Harness
EOF
  echo "  ✓ .gitignore created"
fi
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
if [[ "$FRAMEWORK" != "generic" && -n "$FRAMEWORK" ]]; then
  if [[ -f "$HARNESS_DIR/frameworks/$FRAMEWORK/profile.json" ]] && command -v python3 &>/dev/null; then
    test_cmd=$(python3 -c "import json; d=json.load(open('$HARNESS_DIR/frameworks/$FRAMEWORK/profile.json')); print(d.get('test_cmd',''))" 2>/dev/null)
    run_cmd=$(python3 -c "import json; d=json.load(open('$HARNESS_DIR/frameworks/$FRAMEWORK/profile.json')); print(d.get('run_cmd',''))" 2>/dev/null)
    lint_cmd=$(python3 -c "import json; d=json.load(open('$HARNESS_DIR/frameworks/$FRAMEWORK/profile.json')); print(d.get('lint_cmd',''))" 2>/dev/null)
    echo "  $FRAMEWORK commands:"
    [[ -n "$run_cmd" ]]  && echo "    $run_cmd"
    [[ -n "$test_cmd" ]] && echo "    $test_cmd"
    [[ -n "$lint_cmd" ]] && echo "    $lint_cmd"
    echo ""
  fi
fi
echo "  Docs:"
echo "    docs/HARNESS.md        — hybrid harness model"
echo "    docs/FEATURE_INTAKE.md — classify work"
echo "    docs/TRACE_SPEC.md     — trace quality tiers"
echo ""
echo "  Durable layer:"
echo "    scripts/bin/harness-cli query matrix"
echo "    scripts/bin/harness-cli query stats"
