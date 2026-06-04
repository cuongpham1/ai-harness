# frameworks/swift

Swift (iOS) framework profile for the ai-harness stack.

## detect_framework — glob limitation

`install.sh detect_framework` tests each entry in the `detect` array using a
literal `-f "$target/$f"` file test (Bash). This means **glob patterns are
never expanded**: entries like `*.xcodeproj` or `*.xcworkspace` will never
match any file on disk and are therefore useless as detect values.

For this reason `profile.json` uses **literal filenames** instead:

```json
"detect": ["Podfile", "Package.swift"]
```

Both real VNDirect host projects (`Protrade-IOS`, `Vndirect_Stock_Trading-IOS`)
have a `Podfile` at their repository root, so automatic detection works
correctly for CocoaPods-managed projects.

### Pure-Xcode projects (no Podfile / Package.swift)

If a project is managed by Xcode alone — no CocoaPods, no Swift Package
Manager manifest at the root — none of the detect entries will match and
`detect_framework` will fall through to the `generic` fallback.

**Workaround:** pass the framework explicitly at harness setup time:

```bash
bash install.sh --framework swift
```

or write the profile manually:

```bash
echo swift > .harness-profile
```

## profile.json cmd fields (empty strings)

`test_cmd`, `lint_cmd`, and `run_cmd` in `profile.json` are intentionally set
to empty strings `""`. Xcode workspace and scheme names are project-specific
and cannot be expressed as a generic fallback without `<Scheme>` placeholders
that would be executed verbatim by `scripts/verify-story.sh`.

**`verify-story.sh` behavior:**
- `run_step` (line ~219) silently skips a command if it is empty — no error.
- If **both** `lint_cmd` and `test_cmd` resolve to empty and no `.harness-verify.json`
  exists, line ~209 emits a warning but exits 0 (non-BLOCK mode).

**Per-project overrides** are provided instead:
- `/Users/cuongpham/Protrade-IOS/.harness-verify.json` — real cmds for Protrade
- `/Users/cuongpham/Vndirect_Stock_Trading-IOS/.harness-verify.json` — real cmds for DGO

`verify-story.sh` prefers `.harness-verify.json` at the project root (lines ~159-163)
over the framework `profile.json`, so the overrides take effect automatically.

## Simulator destinations

Commands in `profile.json`, `SWIFT_STACK.md`, and skills use `name=iPhone 16e`
as the concrete example — this is the simulator available on the development
machine at time of writing. **Always run `xcrun simctl list devices available`**
and substitute a name that exists on the current machine. For analyze/build-only
steps, `generic/platform=iOS Simulator` avoids the need for a specific simulator.
