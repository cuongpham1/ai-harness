# Flutter Run

Launch Flutter app on a connected device or simulator.

## Usage
/flutter-run [device]

## Steps
1. Check connected devices: `flutter devices`
2. For iOS simulator: `open -a Simulator` if not running
3. Run on specific device: `flutter run -d <device-id>`
4. Run on first available: `flutter run`
5. Hot reload during session: press `r` in terminal
6. Hot restart: press `R`
7. Quit: press `q`

## Common device IDs
- `flutter run -d iPhone` — iOS simulator (any iPhone)
- `flutter run -d emulator-5554` — Android emulator
- `flutter run -d chrome` — Web (debug)
- `flutter run -d macos` — macOS desktop

## Troubleshooting
- `flutter clean && flutter pub get` before running if build errors occur
- `flutter doctor` to verify SDK and toolchain setup
- If Xcode simulator won't connect: `xcrun simctl list` and boot the device ID
