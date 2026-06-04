<!-- FRAMEWORK-RULES:BEGIN id=swift -->
## Swift (iOS) context triggers

| Trigger | Read |
|---------|------|
| View / SwiftUI change | Adjacent View files, ViewModel, and shared components in `CustomView/` |
| ViewModel / state change | Repository files, DataModel, and Combine/async patterns in use |
| Flutter bridge change | `FlutterModuleBusBridge.swift`, channel contract in `SWIFT_STACK.md` |
| CocoaPods / Podfile change | `Podfile.lock`, affected pod specs, rebuild with `pod install` |
| Network / Remote change | `Remote/` repository files, DataModel for response types |
| Build config / xcconfig | `Config*.xcconfig` files, scheme build settings |

Use `docs/SWIFT_STACK.md` for validation commands and scheme names.
<!-- FRAMEWORK-RULES:END -->
