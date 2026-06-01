#!/usr/bin/env bash
# Token-efficient pytest/ruff wrapper for Python projects.
# Usage: bash scripts/rtk-python.sh test [pytest args...]
#        bash scripts/rtk-python.sh lint
set -uo pipefail

SUB="${1:-test}"
shift || true

filter_pytest() {
  awk '
    BEGIN { in_fail = 0; stack = 0 }
    /^=+ .* (passed|failed|error|skipped)/ { print; next }
    /^FAILED |^ERROR / { print; in_fail = 1; stack = 0; next }
    in_fail && /^[[:space:]]+/ { print; next }
    in_fail && /^E / { print; next }
    /AssertionError|assert / { print; in_fail = 1; next }
    /^\.+/ { next }
    /^collected / { print; next }
    { if (in_fail) in_fail = 0; next }
  '
}

filter_ruff() {
  awk '
    /error|warning|Found [0-9]+/ { print; next }
    /All checks passed/ { print; next }
    { next }
  '
}

case "$SUB" in
  test)
    if command -v pytest >/dev/null 2>&1; then
      pytest "$@" 2>&1 | filter_pytest
    else
      python -m pytest "$@" 2>&1 | filter_pytest
    fi
    exit "${PIPESTATUS[0]}"
    ;;
  lint)
    if command -v ruff >/dev/null 2>&1; then
      ruff check "$@" 2>&1 | filter_ruff
      exit "${PIPESTATUS[0]}"
    fi
    echo "ruff not found" >&2
    exit 1
    ;;
  *)
    exec python -m "$SUB" "$@"
    ;;
esac
