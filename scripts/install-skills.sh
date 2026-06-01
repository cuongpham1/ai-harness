#!/usr/bin/env bash
# Harness Skill Installer
# Finds and installs skills for a given framework into .claude/skills/
#
# Usage:
#   bash scripts/install-skills.sh [framework] [target_dir]
#   bash scripts/install-skills.sh flutter .
#   bash scripts/install-skills.sh --list
#   bash scripts/install-skills.sh --list flutter

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(dirname "$SCRIPT_DIR")"
REGISTRY="$HARNESS_DIR/frameworks/_schema/skill-registry.json"

usage() {
  cat <<EOF
Usage: bash scripts/install-skills.sh [framework] [target_dir]
       bash scripts/install-skills.sh --list [framework]

Options:
  --list [framework]   List available skills (optionally filter by framework)
  --dry-run            Show what would be installed without writing files

Examples:
  bash scripts/install-skills.sh flutter .
  bash scripts/install-skills.sh react /path/to/project
  bash scripts/install-skills.sh --list
  bash scripts/install-skills.sh --list python
EOF
}

list_skills() {
  local filter="${1:-}"
  echo ""
  echo "Available skills:"
  if command -v python3 &>/dev/null && [[ -f "$REGISTRY" ]]; then
    python3 -c "
import json
d = json.load(open('$REGISTRY'))
for name, skill in d['skills'].items():
    fw = skill['framework']
    if '$filter' and fw != '$filter':
        continue
    src = skill['source']
    print(f'  {name:<20} [{fw}]  {skill[\"description\"]}  ({src})')
"
  else
    echo "  (python3 required for registry listing)"
    ls "$HARNESS_DIR/frameworks"/*/skills/*.md 2>/dev/null | while read -r f; do
      echo "  $(basename "$f" .md)"
    done
  fi
  echo ""
}

install_skill() {
  local skill_name="$1"
  local target="$2"
  local dry_run="${3:-false}"
  local harness_dir="$HARNESS_DIR"

  # Look up in registry
  local framework file source
  if command -v python3 &>/dev/null && [[ -f "$REGISTRY" ]]; then
    framework=$(python3 -c "import json; d=json.load(open('$REGISTRY')); print(d['skills'].get('$skill_name', {}).get('framework', ''))" 2>/dev/null)
    file=$(python3 -c "import json; d=json.load(open('$REGISTRY')); print(d['skills'].get('$skill_name', {}).get('file', ''))" 2>/dev/null)
    source=$(python3 -c "import json; d=json.load(open('$REGISTRY')); print(d['skills'].get('$skill_name', {}).get('source', 'bundled'))" 2>/dev/null)
  fi

  if [[ -z "$framework" || -z "$file" ]]; then
    echo "  ⚠ Skill not found in registry: $skill_name"
    return 1
  fi

  local src_path="$harness_dir/frameworks/$framework/skills/$file"
  local dst_path="$target/.claude/skills/$file"

  if [[ "$source" == "bundled" ]]; then
    if [[ -f "$src_path" ]]; then
      if [[ "$dry_run" == "true" ]]; then
        echo "  [dry-run] would copy: $src_path → $dst_path"
      else
        mkdir -p "$target/.claude/skills"
        cp "$src_path" "$dst_path"
        echo "  ✓ .claude/skills/$file"
      fi
    else
      echo "  ⚠ Bundled skill file missing: $src_path"
    fi
  elif [[ "$source" == "remote" ]]; then
    # Future: download from registry_url
    local url
    url=$(python3 -c "import json; d=json.load(open('$REGISTRY')); base=d['registry_url']; fw='$framework'; f='$file'; print(f'{base}/{fw}/skills/{f}')" 2>/dev/null)
    if [[ "$dry_run" == "true" ]]; then
      echo "  [dry-run] would download: $url → $dst_path"
    else
      mkdir -p "$target/.claude/skills"
      if command -v curl &>/dev/null; then
        curl -fsSL "$url" -o "$dst_path"
        echo "  ✓ .claude/skills/$file (downloaded)"
      else
        echo "  ⚠ curl not found — cannot download remote skill"
      fi
    fi
  fi
}

install_framework_skills() {
  local framework="$1"
  local target="$2"
  local dry_run="${3:-false}"

  echo ""
  echo "Installing skills for: $framework"

  if command -v python3 &>/dev/null && [[ -f "$REGISTRY" ]]; then
    local skills
    skills=$(python3 -c "
import json
d = json.load(open('$REGISTRY'))
for name, skill in d['skills'].items():
    if skill['framework'] == '$framework':
        print(name)
" 2>/dev/null)
    while IFS= read -r skill; do
      [[ -z "$skill" ]] && continue
      install_skill "$skill" "$target" "$dry_run"
    done <<< "$skills"
  else
    # Fallback: copy all skills from framework dir
    local fw_skills_dir="$HARNESS_DIR/frameworks/$framework/skills"
    if [[ -d "$fw_skills_dir" ]]; then
      for f in "$fw_skills_dir"/*.md; do
        [[ -f "$f" ]] || continue
        if [[ "$dry_run" == "true" ]]; then
          echo "  [dry-run] would copy: $(basename "$f")"
        else
          mkdir -p "$target/.claude/skills"
          cp "$f" "$target/.claude/skills/"
          echo "  ✓ .claude/skills/$(basename "$f")"
        fi
      done
    fi
  fi
}

# --- Main ---

DRY_RUN=false
FRAMEWORK=""
TARGET="${2:-.}"

case "${1:-}" in
  --help|-h) usage; exit 0 ;;
  --list)    list_skills "${2:-}"; exit 0 ;;
  --dry-run) DRY_RUN=true; FRAMEWORK="${2:-}"; TARGET="${3:-.}" ;;
  "")        usage; exit 1 ;;
  *)         FRAMEWORK="$1"; TARGET="${2:-.}" ;;
esac

if [[ -z "$FRAMEWORK" ]]; then
  # Auto-detect from .harness-profile
  FRAMEWORK=$(cat "$TARGET/.harness-profile" 2>/dev/null || echo "")
  if [[ -z "$FRAMEWORK" ]]; then
    echo "Error: no framework specified and .harness-profile not found"
    echo "Usage: bash scripts/install-skills.sh <framework> [target_dir]"
    exit 1
  fi
  echo "Auto-detected framework: $FRAMEWORK"
fi

install_framework_skills "$FRAMEWORK" "$TARGET" "$DRY_RUN"

echo ""
echo "Done. Skills installed to $TARGET/.claude/skills/"
echo "Run 'bash scripts/install-skills.sh --list $FRAMEWORK' to see all available skills."
