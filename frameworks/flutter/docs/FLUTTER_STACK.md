# Flutter Stack

Reference for agents working on Flutter/Dart projects.

## Commands

| Action | Command |
|--------|---------|
| Dependencies | `flutter pub get` |
| Analyze | `flutter analyze` |
| Test | `flutter test` |
| Run | `flutter run` |
| Integration | `flutter test integration_test/` (if present) |

## Structure (typical)

```
lib/
  main.dart
  features/ or modules/
test/
integration_test/   # optional
pubspec.yaml
```

## Architecture

Prefer clear separation: UI/widgets → state (BLoC/Riverpod/Provider) → domain/services → data sources.

## Testing

- Unit tests for logic and state
- Widget tests for UI states (loading, error, success)
- Integration tests for critical user flows

## Validation before done

```bash
flutter analyze && flutter test
```
