<!-- FRAMEWORK:BEGIN id=swift -->
## Swift (iOS) Stack

| Doc | When to read |
|-----|-------------|
| docs/SWIFT_STACK.md | Before any Swift/iOS implementation |

### Commands
- Test: `xcodebuild test -workspace <Workspace> -scheme <Scheme> -destination 'platform=iOS Simulator,name=iPhone 16'`
- Lint: `xcodebuild analyze -workspace <Workspace> -scheme <Scheme> -destination 'platform=iOS Simulator,name=iPhone 16'`
- Build: `xcodebuild build -workspace <Workspace> -scheme <Scheme> -destination 'platform=iOS Simulator,name=iPhone 16'`

### Rules
- Always use `.xcworkspace` (not `.xcodeproj`) when CocoaPods are present
- Run `pod install` after Podfile changes
- Never edit files under `Pods/`
- Flutter channel calls only through dedicated bridge class — never from UI or ViewModel

### Skills
- `/swift-build` — build project on simulator
- `/swift-test` — run unit and UI tests

> Scheme names, workspace filenames, and test target names for both projects are listed in `docs/SWIFT_STACK.md` — read it before constructing any xcodebuild command.
<!-- FRAMEWORK:END -->
