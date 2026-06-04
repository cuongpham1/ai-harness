# Swift (iOS) Stack

Reference for agents working on native iOS projects. Grounded in two real VNDirect superapp host apps:

- **Protrade-IOS** — DSTOCK host, bundle `vn.com.vndirect.protrade`, workspace `Protrade.xcworkspace`
- **Vndirect_Stock_Trading-IOS** — DGO host, bundle `vn.com.vndirect.stocks`, workspace `Vndirect_Stock_Trading-IOS.xcworkspace`

Both embed the Flutter add-to-app module (`flutter_module_bus`) via CocoaPods.

---

## Commands

Before running commands, discover the simulators available on the current machine:

```bash
xcrun simctl list devices available | grep iPhone
```

Use a simulator name that appears in that output (e.g. `iPhone 16e`). The examples below use `iPhone 16e` — adjust to match your installed simulators.

| Action | Command |
|--------|---------|
| Install pods | `pod install` |
| Build (DSTOCK) | `xcodebuild build -workspace Protrade.xcworkspace -scheme Protrade -destination 'platform=iOS Simulator,name=iPhone 16e'` |
| Build (DGO) | `xcodebuild build -workspace Vndirect_Stock_Trading-IOS.xcworkspace -scheme Vndirect_Stock_Trading-IOS -destination 'platform=iOS Simulator,name=iPhone 16e'` |
| Analyze (lint) | `xcodebuild analyze -workspace <Workspace> -scheme <Scheme> -destination 'generic/platform=iOS Simulator'` |
| Test (DSTOCK) | `xcodebuild test -workspace Protrade.xcworkspace -scheme Protrade -destination 'platform=iOS Simulator,name=iPhone 16e'` |
| Test (DGO) | `xcodebuild test -workspace Vndirect_Stock_Trading-IOS.xcworkspace -scheme Vndirect_Stock_Trading-IOS -destination 'platform=iOS Simulator,name=iPhone 16e'` |
| List schemes | `xcodebuild -list -workspace <Workspace>` |

> **Note on `generic/platform=iOS Simulator`:** For analyze and archive/build-only steps that do not need a booted device, `generic/platform=iOS Simulator` avoids requiring a specific simulator to be installed. For test runs a concrete device name is required.

---

## Scheme Names (verified from xcshareddata/xcschemes/)

| Project | Schemes |
|---------|---------|
| Protrade-IOS | `Protrade`, `Protrade_UAT` |
| Vndirect_Stock_Trading-IOS | `Vndirect_Stock_Trading-IOS`, `Vndirect_Stock_Trading-IOS_UAT` |

Production builds use the non-UAT scheme. UAT schemes point at staging backend.

---

## Project Structure

```
<Project>.xcworkspace        # Always use workspace (not .xcodeproj) when CocoaPods present
Podfile                      # CocoaPods manifest — never edit Pods/ directly
Pods/                        # Generated — do not commit changes
<AppName>/
  AppDelegate.swift          # App entry, Flutter engine boot (DGO only)
  Module/                    # Feature modules (SwiftUI Views + ViewModels)
    DActive/
      FlutterBridge/         # Flutter add-to-app integration (DGO only)
  Remote/                    # Network layer (Repositories)
  DataModel/                 # Data models
  Utils/                     # Shared utilities
  Ext/                       # Swift extensions
<AppName>Tests/              # Unit tests (XCTest)
<AppName>UITests/            # UI tests (XCTest + XCUIApplication)
```

DSTOCK (Protrade) test targets: `ProtradeTests`, `ProtradeUITests`
DGO test targets: `Vndirect_Stock_Trading-IOSTests`, `Vndirect_Stock_Trading-IOSUITests`

---

## Architecture

- **SwiftUI** for views, **ObservableObject / @StateObject / @EnvironmentObject** for state
- **MVVM**: `View` ← `ViewModel (ObservableObject)` ← `Repository` ← `Remote/`
- **Async/Await** preferred for network calls; Combine used for reactive streams
- Never put business logic in views — keep views thin

---

## CocoaPods Rules

- Run `pod install` after any `Podfile` change, then open the `.xcworkspace`
- Never open `.xcodeproj` directly when a workspace exists
- Never manually edit files under `Pods/`
- `Podfile.lock` is committed; regenerating it requires team coordination

---

## Flutter Add-to-App Integration

Both apps embed the Flutter module (`flutter_module_bus`) as a compiled iOS framework via CocoaPods (using `podhelper.rb`).

**`FlutterModuleBusBridge.swift` exists in DGO (`Vndirect_Stock_Trading-IOS`) only.** If Protrade-IOS needs a native bridge class, follow the DGO pattern below.

**Channel name:** `com.vndirect.superapp/module_bus`

### iOS side (Swift)

```swift
import Flutter

// Boot the engine once (singleton)
let engine = FlutterEngine(name: "com.vndirect.flutter.demo.engine")
engine.run()
GeneratedPluginRegistrant.register(with: engine)

// Open the method channel
let channel = FlutterMethodChannel(
    name: "com.vndirect.superapp/module_bus",
    binaryMessenger: engine.binaryMessenger
)

// Handle calls FROM Flutter
channel.setMethodCallHandler { call, result in
    switch call.method {
    case "host.getInitialConfig":
        result(currentConfig)          // [String: Any]
    case "bus.command":
        result(routeCommand(call.arguments))
    default:
        result(FlutterMethodNotImplemented)
    }
}

// Push config TO Flutter
channel.invokeMethod("host.updateConfig", arguments: config)
```

### Flutter → Native methods

| Method | Payload | Notes |
|--------|---------|-------|
| `host.getInitialConfig` | none | Returns env/token/language dict |
| `bus.command` | `{ id, version, module, action, payload, meta }` | Generic command envelope |

### Native → Flutter methods

| Method | Payload |
|--------|---------|
| `host.updateConfig` | `[String: Any]` config dict |

**Rule:** Never call `MethodChannel` from UI or ViewModel directly. All calls go through a dedicated bridge class (e.g. `FlutterModuleBusBridge` in DGO).

---

## Build Variants

| Variant | Scheme | Bundle ID |
|---------|--------|-----------|
| DSTOCK (Protrade) | `Protrade` / `Protrade_UAT` | `vn.com.vndirect.protrade` |
| DGO | `Vndirect_Stock_Trading-IOS` / `Vndirect_Stock_Trading-IOS_UAT` | `vn.com.vndirect.stocks` |

Xcconfig files (`Config.xcconfig`, `Config-UAT.xcconfig`, `Config-Release.xcconfig`) set per-environment values (base URLs, feature flags).

---

## Testing

- **Unit tests:** `XCTest` in `<App>Tests/` — cover ViewModels, Repositories, utility functions
- **UI tests:** `XCTest` (with `XCUIApplication`) in `<App>UITests/` — cover critical user flows via `XCUIApplication().launch()`
- Use `@testable import <App>` to access internal types
- Mock network layer via protocol-based injection (avoid URLSession mocking in production code)

## Validation before done

```bash
# Discover available simulators first:
xcrun simctl list devices available | grep iPhone

# Then analyze (generic destination — no simulator boot required):
xcodebuild analyze -workspace <Workspace> -scheme <Scheme> \
  -destination 'generic/platform=iOS Simulator' \
  | grep -E 'error:|warning:|FAILED|BUILD SUCCEEDED'
```
