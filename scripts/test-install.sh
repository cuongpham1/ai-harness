#!/usr/bin/env bash
# Install smoke test — guards the bug classes bash -n cannot catch.
#
# Covers regressions like backlog-19 (select_framework stdout pollution broke
# auto-detect install) and backlog-20 (profile.json shadowing .harness-verify.json).
#
# Runs install.sh into a throwaway target and asserts the result is sane.
# Exit 0 = all pass, 1 = a failure.
set -uo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILS=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }

TARGET="$(mktemp -d)"
trap 'rm -rf "$TARGET"' EXIT

# nodejs auto-detect signal
echo '{"name":"smoke","version":"1.0.0"}' >"$TARGET/package.json"

echo "=== fresh install (auto-detect, no --framework) ==="
if bash "$HARNESS_DIR/install.sh" --yes "$TARGET" >"$TARGET/.install.log" 2>&1; then
  pass "install.sh exits 0"
else
  fail "install.sh exited nonzero"; sed 's/^/  /' "$TARGET/.install.log" | tail -20
fi

# backlog-19: .harness-profile must be a single clean token (menu text never
# captured into FRAMEWORK). A multiline / spaced value means stdout pollution.
PROFILE="$(cat "$TARGET/.harness-profile" 2>/dev/null || echo)"
if [[ -n "$PROFILE" && "$(printf '%s' "$PROFILE" | wc -l | tr -d ' ')" == "0" && ! "$PROFILE" =~ [[:space:]] ]]; then
  pass "harness-profile is single clean token ($PROFILE)"
else
  fail "harness-profile polluted: '$PROFILE' (backlog-19 regression)"
fi

# Resolved framework must map to a real profile dir.
if [[ -n "$PROFILE" && ( -f "$HARNESS_DIR/frameworks/$PROFILE/profile.json" || "$PROFILE" == "generic" ) ]]; then
  pass "framework '$PROFILE' resolves to a real profile"
else
  fail "framework '$PROFILE' has no profile dir (Framework dir not found class)"
fi

# settings.json must be present + valid JSON with hook wiring.
if node -e "const s=require('$TARGET/.claude/settings.json'); if(!s.hooks||!s.hooks.SessionStart) process.exit(1)" 2>/dev/null; then
  pass "settings.json valid + has hooks"
else
  fail "settings.json missing/invalid/no hooks"
fi

echo "=== backlog-20: verify-story prefers .harness-verify.json ==="
# Static precedence guard: the .harness-verify.json branch must come before the
# frameworks/<id>/profile.json branch so a copied profile can't shadow it.
VS="$HARNESS_DIR/scripts/verify-story.sh"
verify_line=$(grep -n 'harness-verify.json"' "$VS" | head -1 | cut -d: -f1)
fw_line=$(grep -n 'frameworks/\$FRAMEWORK/profile.json"' "$VS" | head -1 | cut -d: -f1)
if [[ -n "$verify_line" && -n "$fw_line" && "$verify_line" -lt "$fw_line" ]]; then
  pass "verify-story checks .harness-verify.json before framework profile"
else
  fail ".harness-verify.json not preferred (verify=$verify_line fw=$fw_line — backlog-20 regression)"
fi

echo "=== upgrade idempotency ==="
if bash "$HARNESS_DIR/install.sh" --yes "$TARGET" >"$TARGET/.upgrade.log" 2>&1; then
  pass "upgrade re-run exits 0"
  if grep -q "Upgrade mode" "$TARGET/.upgrade.log"; then
    pass "second run detected as upgrade"
  else
    fail "second run not detected as upgrade"
  fi
else
  fail "upgrade re-run exited nonzero"; tail -20 "$TARGET/.upgrade.log"
fi

echo ""
if [[ "$FAILS" -eq 0 ]]; then
  echo "install smoke: all checks passed"
  exit 0
else
  echo "install smoke: $FAILS check(s) failed"
  exit 1
fi
