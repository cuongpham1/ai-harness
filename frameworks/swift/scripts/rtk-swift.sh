#!/usr/bin/env bash
# rtk-swift.sh — token-efficient xcodebuild command wrapper
# Usage: scripts/rtk-swift.sh <subcommand> [args...]
# Subcommands: build, test, analyze, pod
# Routes to xcodebuild/pod, filters verbose output, preserves exit code.
# Est. savings: ~85% on xcodebuild test output, ~75% on xcodebuild build

set -euo pipefail

SUBCOMMAND="${1:-}"
shift || true

xcode_build() {
  local exit_code=0

  xcodebuild build "$@" 2>&1 | awk '
    BEGIN { last_was_blank = 0 }

    # Keep errors
    /error:/ {
      print; last_was_blank = 0; next
    }

    # Keep warnings (summary only — skip per-file noise)
    /warning:.*generated/ {
      print; last_was_blank = 0; next
    }

    # Keep build result lines
    /^BUILD SUCCEEDED/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }
    /^BUILD FAILED/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }

    # Drop: per-file compile lines
    /^CompileSwift|^CompileC|^Ld |^CopySwiftLibs|^ProcessInfoPlistFile/ { next }
    /^CodeSign|^Touch |^Ditto |^CreateBuildDirectory|^MkDir/ { next }
    /^PhaseScriptExecution|^WriteAuxiliaryFile|^RegisterExecutionPolicyException/ { next }
    /^note:|^    note:/ { next }

    # Drop: xcodebuild header noise
    /^=== BUILD TARGET|^=== BUILD AGGREGATE TARGET/ { next }

    # Blank lines
    /^$/ { last_was_blank = 1; next }

    # Drop everything else
    { next }
  ' || exit_code=$?

  exit "$exit_code"
}

xcode_test() {
  local exit_code=0

  xcodebuild test "$@" 2>&1 | awk '
    BEGIN { last_was_blank = 0 }

    # Keep errors
    /error:/ {
      print; last_was_blank = 0; next
    }

    # Keep test failures
    /Test Case.*FAILED/ {
      print; last_was_blank = 0; next
    }
    /failed with/ {
      print; last_was_blank = 0; next
    }
    /XCTAssert|XCTFail/ {
      print; last_was_blank = 0; next
    }

    # Keep test summary
    /^Test Suite.*passed/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }
    /^Test Suite.*failed/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }
    /^Executed [0-9]+ test/ {
      print; last_was_blank = 0; next
    }

    # Keep build result
    /^BUILD SUCCEEDED|^BUILD FAILED/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }

    # Keep TEST EXECUTION result
    /^TEST SUCCEEDED|^TEST FAILED/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }

    # Drop: passing test lines
    /Test Case.*passed/ { next }

    # Drop: compile/link noise
    /^CompileSwift|^CompileC|^Ld |^CopySwiftLibs/ { next }
    /^CodeSign|^Touch |^Ditto |^CreateBuildDirectory|^MkDir/ { next }
    /^PhaseScriptExecution|^WriteAuxiliaryFile/ { next }
    /^note:|^    note:/ { next }
    /^=== BUILD TARGET/ { next }

    # Blank lines
    /^$/ { last_was_blank = 1; next }

    # Drop everything else
    { next }
  ' || exit_code=$?

  exit "$exit_code"
}

xcode_analyze() {
  local exit_code=0

  xcodebuild analyze "$@" 2>&1 | awk '
    BEGIN { last_was_blank = 0 }

    # Keep errors
    /error:/ {
      print; last_was_blank = 0; next
    }

    # Keep warnings
    /warning:/ {
      print; last_was_blank = 0; next
    }

    # Keep static analyzer findings
    /Analyzer:/ {
      print; last_was_blank = 0; next
    }

    # Keep build result (xcodebuild analyze emits BUILD SUCCEEDED/FAILED)
    /^BUILD SUCCEEDED|^BUILD FAILED/ {
      if (last_was_blank == 0) print ""
      print; last_was_blank = 0; next
    }

    # Drop compile noise
    /^CompileSwift|^AnalyzeShallow|^Ld |^MkDir/ { next }
    /^CodeSign|^Touch |^Ditto |^CreateBuildDirectory/ { next }
    /^PhaseScriptExecution|^WriteAuxiliaryFile/ { next }
    /^note:|^    note:/ { next }
    /^=== BUILD TARGET/ { next }

    # Blank lines
    /^$/ { last_was_blank = 1; next }

    # Drop everything else
    { next }
  ' || exit_code=$?

  exit "$exit_code"
}

pod_install() {
  local exit_code=0

  pod install "$@" 2>&1 | awk '
    BEGIN { printed_analyzing = 0 }

    # Keep pod install summary
    /^Pod installation complete!/ { print; next }
    /^Generating Pods project/ { print; next }
    /^Integrating client project/ { print; next }

    # Keep error lines
    /[Ee]rror:?/ { print; next }
    /\[!\]/ { print; next }

    # Keep result line
    /pods? installed/ { print; next }

    # Drop per-pod lines, downloading noise
    { next }
  ' || exit_code=$?

  exit "$exit_code"
}

case "$SUBCOMMAND" in
  build)   xcode_build "$@" ;;
  test)    xcode_test "$@" ;;
  analyze) xcode_analyze "$@" ;;
  pod)     pod_install "$@" ;;
  *)       exec xcodebuild "$SUBCOMMAND" "$@" ;;
esac
