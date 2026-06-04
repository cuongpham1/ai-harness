# Swift Test

Run unit and UI tests via xcodebuild.

## Usage
/swift-test [target] [filter]

## Test Targets

| Project | Unit Tests | UI Tests |
|---------|-----------|---------|
| Protrade-IOS | `ProtradeTests` | `ProtradeUITests` |
| Vndirect_Stock_Trading-IOS | `Vndirect_Stock_Trading-IOSTests` | `Vndirect_Stock_Trading-IOSUITests` |

## Discover available simulators

Always check which simulators are installed before running tests:

```bash
xcrun simctl list devices available | grep iPhone
```

Use a name from that output (e.g. `iPhone 16e`). The examples below use `iPhone 16e`.

## Steps

### Run all tests — Protrade-IOS (DSTOCK)
```bash
xcodebuild test \
  -workspace Protrade.xcworkspace \
  -scheme Protrade \
  -destination 'platform=iOS Simulator,name=iPhone 16e'
```

### Run all tests — Vndirect_Stock_Trading-IOS (DGO)
```bash
xcodebuild test \
  -workspace Vndirect_Stock_Trading-IOS.xcworkspace \
  -scheme Vndirect_Stock_Trading-IOS \
  -destination 'platform=iOS Simulator,name=iPhone 16e'
```

### Run specific test class
```bash
xcodebuild test \
  -workspace Protrade.xcworkspace \
  -scheme Protrade \
  -destination 'platform=iOS Simulator,name=iPhone 16e' \
  -only-testing:ProtradeTests/MyViewModelTests
```

### Run specific test method
```bash
xcodebuild test \
  -workspace Protrade.xcworkspace \
  -scheme Protrade \
  -destination 'platform=iOS Simulator,name=iPhone 16e' \
  -only-testing:ProtradeTests/MyViewModelTests/testFetchData
```

### UI tests only
```bash
xcodebuild test \
  -workspace Protrade.xcworkspace \
  -scheme Protrade \
  -destination 'platform=iOS Simulator,name=iPhone 16e' \
  -only-testing:ProtradeUITests
```

## Filtered output (via rtk-swift.sh)
```bash
bash scripts/rtk-swift.sh test \
  -workspace Protrade.xcworkspace \
  -scheme Protrade \
  -destination 'platform=iOS Simulator,name=iPhone 16e'
```

## Reading results
- Pass: `Executed N tests, with 0 failures ... TEST SUCCEEDED`
- Fail: shows failing test name, file, line, and assertion message
- Use `-resultBundlePath ./TestResults.xcresult` to save results for Xcode viewing

## Writing tests (XCTest)
```swift
import XCTest
@testable import Protrade

final class MyViewModelTests: XCTestCase {
    func testExample() async throws {
        let vm = MyViewModel()
        await vm.fetchData()
        XCTAssertFalse(vm.items.isEmpty)
    }
}
```

## Writing UI tests (XCTest + XCUIApplication)
```swift
import XCTest

final class MyUITests: XCTestCase {
    func testLaunch() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["Login"].exists)
    }
}
```

## Coverage
```bash
xcodebuild test \
  -workspace Protrade.xcworkspace \
  -scheme Protrade \
  -destination 'platform=iOS Simulator,name=iPhone 16e' \
  -enableCodeCoverage YES
```

## Troubleshooting
- **Simulator not found:** `xcrun simctl list devices available` to see available simulators; adjust destination name to match
- **Build fails before tests:** fix build errors first — `bash scripts/rtk-swift.sh build ...`
- **Tests hang:** check for async code missing `await`, or UI tests missing `XCUIApplication().launch()`
