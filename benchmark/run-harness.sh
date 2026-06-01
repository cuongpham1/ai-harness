#!/usr/bin/env bash
# Deterministic harness benchmark (H3) — no live agent required.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
exec node "$SCRIPT_DIR/run-harness.mjs" "$@"
