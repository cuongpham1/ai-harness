# Swift Build

Build the iOS app on the simulator using xcodebuild.

## Usage
/swift-build [scheme] [destination]

## Prerequisites
- Xcode installed (`xcode-select --install` if missing)
- CocoaPods installed (`gem install cocoapods`)
- Pods installed (`pod install` after any Podfile change)

## Discover available simulators

Always check which simulators are installed before building:

```bash
xcrun simctl list devices available | grep iPhone
```

Use a name from that output (e.g. `iPhone 16e`). The examples below use `iPhone 16e`.

## Steps

### Protrade-IOS (DSTOCK)
1. Ensure pods are current: `pod install` (from project root)
2. Build on simulator:
   ```bash
   xcodebuild build \
     -workspace Protrade.xcworkspace \
     -scheme Protrade \
     -destination 'platform=iOS Simulator,name=iPhone 16e'
   ```
3. UAT variant: replace `-scheme Protrade` with `-scheme Protrade_UAT`

### Vndirect_Stock_Trading-IOS (DGO)
1. Ensure pods are current: `pod install`
2. Build on simulator:
   ```bash
   xcodebuild build \
     -workspace Vndirect_Stock_Trading-IOS.xcworkspace \
     -scheme Vndirect_Stock_Trading-IOS \
     -destination 'platform=iOS Simulator,name=iPhone 16e'
   ```
3. UAT variant: replace scheme with `Vndirect_Stock_Trading-IOS_UAT`

## Filtered output (via rtk-swift.sh)
```bash
bash scripts/rtk-swift.sh build \
  -workspace Protrade.xcworkspace \
  -scheme Protrade \
  -destination 'platform=iOS Simulator,name=iPhone 16e'
```

## Common destinations
- `'platform=iOS Simulator,name=iPhone 16e'` — adjust name to match installed simulators
- `'generic/platform=iOS Simulator'` — analyze/build without requiring a specific simulator (no boot needed)
- `'generic/platform=iOS'` — generic device (archive builds, no simulator)

## Troubleshooting
- **Missing pods:** `pod install` then retry
- **Code signing errors on simulator:** add `CODE_SIGNING_ALLOWED=NO` to xcodebuild args (simulator/CI only — omit on a dev machine with signing configured)
- **Workspace not found:** always run from the project root directory
- **DerivedData stale:** `rm -rf ~/Library/Developer/Xcode/DerivedData/<App>-*`
- **Flutter pod missing:** ensure Flutter module is built (`bash scripts/build_ios_*.sh` from flutter_module_bus)

## List available schemes
```bash
xcodebuild -list -workspace Protrade.xcworkspace
xcodebuild -list -workspace Vndirect_Stock_Trading-IOS.xcworkspace
```
