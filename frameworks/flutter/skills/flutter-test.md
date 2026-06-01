# Flutter Test

Run Flutter tests with filtered, readable output.

## Usage
/flutter-test [filter] [--coverage]

## Steps
1. Run all tests: `flutter test`
2. Run specific file: `flutter test test/path/to/widget_test.dart`
3. Run by name filter: `flutter test --name "login"`
4. Run with coverage: `flutter test --coverage`
5. View coverage report: `genhtml coverage/lcov.info -o coverage/html && open coverage/html/index.html`

## Integration tests
- Run integration tests: `flutter test integration_test/`
- Run on device: `flutter test integration_test/ -d <device-id>`

## Filtered output (via rtk-flutter.sh if present)
- `bash scripts/rtk-flutter.sh test` — suppresses verbose pub output
- `bash scripts/rtk-flutter.sh analyze` — clean analyze output

## Reading results
- Pass: `00:XX +N: All tests passed!`
- Fail: shows failing test name, file, line, expected vs actual
- Use `flutter test --reporter expanded` for verbose per-test output

## Coverage thresholds
- Aim for >80% line coverage on business logic (domain/data layers)
- Widget tests cover loading, loaded, and error states minimum
