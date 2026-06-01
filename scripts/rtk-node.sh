#!/usr/bin/env bash
# Token-efficient npm test/lint wrapper for Node/React/Next.js projects.
# Usage: bash scripts/rtk-node.sh test [npm args...]
#        bash scripts/rtk-node.sh lint
set -uo pipefail

SUB="${1:-test}"
shift || true

filter_test() {
  awk '
    BEGIN { fails = 0; last_blank = 0 }
    /FAIL|✕|×|AssertionError|Expected:|Received:|Error:|FAILED/ {
      print; fails = 1; last_blank = 0; next
    }
    /Tests:.*failed|Test Suites:.*failed|passed|PASS / {
      if (last_blank == 0 && NR > 1) print ""
      print; last_blank = 0; next
    }
    /^(PASS|FAIL) / { print; last_blank = 0; next }
    /^Ran [0-9]+ test/ { print; last_blank = 0; next }
    /^> / { next }
    /^npm ERR!/ { print; next }
    fails && /^[[:space:]]+at / { print; next }
    /^[[:space:]]*$/ { last_blank = 1; next }
    { next }
  '
}

filter_lint() {
  awk '
    /error|warning|✖|Error:|problem/ { print; next }
    /✔|No ESLint warnings|All matched files use Prettier/ { print; next }
    /^> / { next }
    { next }
  '
}

case "$SUB" in
  test)
    npm test "$@" 2>&1 | filter_test
    exit "${PIPESTATUS[0]}"
    ;;
  lint)
    npm run lint "$@" 2>&1 | filter_lint
    exit "${PIPESTATUS[0]}"
    ;;
  *)
    exec npm "$SUB" "$@"
    ;;
esac
