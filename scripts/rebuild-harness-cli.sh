#!/usr/bin/env bash
# Rebuild scripts/bin/harness-cli from source (includes query cost and latest schema).
# Falls back to release download when cargo is unavailable.
#
# Usage: bash scripts/rebuild-harness-cli.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$ROOT/scripts/bin/harness-cli"

sha256_file() {
  local file="$1"
  if command -v shasum &>/dev/null; then shasum -a 256 "$file" | awk '{print $1}';
  elif command -v sha256sum &>/dev/null; then sha256sum "$file" | awk '{print $1}';
  else echo ""; fi
}

ensure_cargo() {
  if command -v cargo &>/dev/null; then return 0; fi
  if [[ -x "$HOME/.cargo/bin/cargo" ]]; then
    export PATH="$HOME/.cargo/bin:$PATH"
    return 0
  fi
  if ! command -v curl &>/dev/null; then return 1; fi
  echo "Installing Rust toolchain (rustup)..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
  command -v cargo &>/dev/null
}

build_from_source() {
  echo "Building harness-cli from source..."
  (cd "$ROOT" && cargo build --release -p harness-cli)
  cp "$ROOT/target/release/harness-cli" "$CLI"
  chmod +x "$CLI"
  echo "✓ Built harness-cli from source → scripts/bin/harness-cli"
}

download_release() {
  local tag
  tag="$(cat "$ROOT/scripts/harness-cli-release-tag" 2>/dev/null || echo harness-cli-v0.1.11)"
  local arch platform os_name
  arch="$(uname -m)"
  os_name="$(uname -s)"
  case "$os_name" in
    Darwin) [[ "$arch" == "arm64" ]] && platform="macos-arm64" || platform="macos-x64" ;;
    Linux)  [[ "$arch" == "aarch64" || "$arch" == "arm64" ]] && platform="linux-arm64" || platform="linux-x64" ;;
    *) echo "Unsupported OS: $os_name" >&2; return 1 ;;
  esac
  local base="https://github.com/hoangnb24/repository-harness/releases/download/${tag}"
  local tmp="$CLI.download.$$"
  echo "Downloading $tag ($platform)..."
  curl -fsSL "$base/harness-cli-${platform}" -o "$tmp"
  curl -fsSL "$base/harness-cli-${platform}.sha256" -o "${tmp}.sha256"
  local expected actual
  expected="$(awk '{print $1}' "${tmp}.sha256")"
  actual="$(sha256_file "$tmp")"
  rm -f "${tmp}.sha256"
  if [[ -n "$expected" && "$expected" != "$actual" ]]; then
    rm -f "$tmp"
    echo "Checksum mismatch for release binary" >&2
    return 1
  fi
  mv "$tmp" "$CLI"
  chmod +x "$CLI"
  echo "✓ Downloaded harness-cli ($tag) — may lack unreleased subcommands; prefer source build."
}

mkdir -p "$(dirname "$CLI")"

if ensure_cargo && build_from_source; then
  :
elif download_release; then
  :
else
  echo "Failed to build or download harness-cli" >&2
  exit 1
fi

if "$CLI" query --help 2>&1 | grep -q '\bcost\b'; then
  echo "✓ query cost available"
else
  echo "⚠ query cost not in this binary — rebuild from source when cargo is available" >&2
fi
