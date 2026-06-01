#!/usr/bin/env bash
# Run a command through RTK when available, else pass through unchanged.
# Usage: bash scripts/rtk-shell.sh git status
#        bash scripts/rtk-shell.sh grep -r pattern src/
set -uo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/rtk-shell.sh <command> [args...]" >&2
  exit 1
fi

if command -v rtk >/dev/null 2>&1; then
  exec rtk "$@"
fi

exec "$@"
