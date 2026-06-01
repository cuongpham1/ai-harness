#!/usr/bin/env bash
# rtk-flutter.sh — token-efficient Flutter command wrapper
# Usage: scripts/rtk-flutter.sh <flutter subcommand> [args...]
# Routes to flutter, filters output, preserves exit code.
# Est. savings: ~80% on flutter test output, ~70% on flutter analyze

set -uo pipefail

SUBCOMMAND="${1:-}"
shift || true

flutter_test() {
  local tmpfile
  tmpfile=$(mktemp)

  flutter test "$@" 2>&1 | tee "$tmpfile" | awk '
    BEGIN { in_stack = 0; stack_count = 0; last_was_blank = 0 }

    # Always keep summary lines (timing + result at end)
    /^[0-9]+:[0-9]+ \+[0-9]+:? All tests passed/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }
    /^[0-9]+:[0-9]+[^:]*:? All tests passed/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }
    /All tests passed/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }
    /Some tests failed/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }
    /^[0-9]+:[0-9]+ \+[0-9]+ -[0-9]+:/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }

    # Failure markers — start stack capture
    /FAILED/ {
      print; in_stack = 1; stack_count = 0; last_was_blank = 0; next
    }
    /Expected:/ {
      print; in_stack = 1; stack_count = 0; last_was_blank = 0; next
    }
    /Actual:/ {
      print; last_was_blank = 0; next
    }
    /Which:/ {
      print; last_was_blank = 0; next
    }

    # Test file references
    /test\/.*\.dart/ {
      print; last_was_blank = 0; next
    }

    # Error / exception lines
    /^Error:/ || /^Exception:/ || /^flutter: / {
      print; last_was_blank = 0; next
    }
    /[Ee]rror:/ && !/^[0-9]+:[0-9]+/ {
      print; last_was_blank = 0; next
    }

    # Stack trace lines (5 lines after failure)
    in_stack && /^#[0-9]/ {
      if (stack_count < 5) { print; stack_count++; last_was_blank = 0 }
      if (stack_count >= 5) { in_stack = 0 }
      next
    }

    # Reset stack on blank line
    /^$/ {
      if (in_stack) in_stack = 0
      last_was_blank = 1
      next
    }

    # Drop: progress lines like "00:01 +5: test name"
    /^[0-9]+:[0-9]+ [+-][0-9]+:/ { next }

    # Drop: build/compile noise
    /^Compiling|^Building|^Syncing files|^Running "flutter|^Resolving dependencies/ { next }

    # Drop everything else (passing test lines, etc.)
    { in_stack = 0; next }
  '

  local exit_code=${PIPESTATUS[0]}
  rm -f "$tmpfile"
  exit "$exit_code"
}

flutter_analyze() {
  local tmpfile
  tmpfile=$(mktemp)

  flutter analyze "$@" 2>&1 | tee "$tmpfile" | awk '
    BEGIN { last_was_blank = 0 }

    # Keep error lines
    /error •/ {
      print; last_was_blank = 0; next
    }

    # Keep warning lines
    /warning •/ {
      print; last_was_blank = 0; next
    }

    # Keep hint lines
    /hint •/ {
      print; last_was_blank = 0; next
    }

    # Keep summary lines
    /No issues found/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }
    /[0-9]+ issue/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }

    # Drop: analyzer startup noise
    /^Analyzing |^Building|^Running/ { next }

    # Drop blank lines
    /^$/ { last_was_blank = 1; next }

    # Drop everything else
    { next }
  '

  local exit_code=${PIPESTATUS[0]}
  rm -f "$tmpfile"
  exit "$exit_code"
}

flutter_pub() {
  local subcmd="${1:-}"
  shift || true

  flutter pub "$subcmd" "$@" 2>&1 | awk '
    BEGIN { printed_resolving = 0 }

    # Keep "Resolving dependencies..." (first occurrence only)
    /^Resolving dependencies/ {
      if (printed_resolving == 0) { print; printed_resolving = 1 }
      next
    }

    # Keep result lines
    /Changed [0-9]+ dependenc/ { print; next }
    /No dependencies changed/  { print; next }
    /Got dependencies/          { print; next }

    # Keep error lines
    /[Ee][Rr][Rr]/ { print; next }
    /^Error/        { print; next }

    # Drop individual package lines, downloading, etc.
    { next }
  '

  exit "${PIPESTATUS[0]}"
}

flutter_gen_l10n() {
  flutter gen-l10n "$@" 2>&1 | awk '
    # Keep error lines
    /[Ee]rror/ { print; next }

    # Keep generated file lines
    /Generated|generated|Writing|wrote/ { print; next }

    # Keep success/failure messages
    /^Successfully|^Failed|^Done/ { print; next }

    # Drop progress output
    { next }
  '

  exit "${PIPESTATUS[0]}"
}

case "$SUBCOMMAND" in
  test)     flutter_test "$@" ;;
  analyze)  flutter_analyze "$@" ;;
  pub)      flutter_pub "$@" ;;
  gen-l10n) flutter_gen_l10n "$@" ;;
  *)        exec flutter "$SUBCOMMAND" "$@" ;;
esac
