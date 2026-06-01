# Test Matrix

Behavior-to-proof map for **flutter_module_bus**. Update this file when adding flows or changing validation.

**Legend:** ✅ required before done · ○ recommended · — not applicable

## Quick validation ladder

| Level | Command | When |
|-------|---------|------|
| Quick | `flutter analyze` | Every Dart change |
| Unit | `flutter test test/` | Usecases, BLoC, widgets |
| Integration | `bash scripts/run_integration_test.sh` | IPO user flows (simulator + UAT token) |
| AI UAT | `bash scripts/ai_test/run_uat_ios.sh` | Exploratory UI; semantics / tap issues |
| Native embed | Host app manual + `README_INTEGRATION.md` | Bridge-only changes |

Agents must not claim integration or UAT passed without running the command and checking output.

---

## Module: bus_console (native bridge)

| Behavior | Proof | Command / artifact |
|----------|-------|-------------------|
| DI registers bridge stack | Unit | `flutter test test/modules/bus_console/` |
| getInitialConfig / sendCommand | Unit + channel mock | `module_bus_bloc_test.dart`, `TestDefaultBinaryMessengerBinding` |
| Host update stream | Unit | `observe_host_updates_usecase_test.dart` |
| Contract shape | Doc review | `README_INTEGRATION.md` vs datasource envelope |

---

## Module: IPO — Catalog

| Behavior | Proof | Command / artifact |
|----------|-------|-------------------|
| Catalog loads cards | Integration ✅ | `IPO Catalog › catalog loads with IPO cards` |
| Tab Danh sách ↔ Tra cứu | Integration ✅ | `IPO Catalog › tab switch` |
| Catalog UI smoke | AI UAT ○ | `scripts/ai_test/run_uat_*.sh` → `report.md` |

---

## Module: IPO — Detail

| Behavior | Proof | Command / artifact |
|----------|-------|-------------------|
| Card tap → detail | Integration ✅ | `IPO Detail › tap card → detail screen loads` |
| Detail tabs (issuance / company) | Semantics unit | `test/modules/ipo/features/semantics_labels_test.dart` |
| Register button (open status only) | Integration ○ | Skips when `hasRegisterButton()` false |
| Detail exploration | AI UAT ○ | explore_prompt: tap card, scroll, Đăng ký |

---

## Module: IPO — Registration form

| Behavior | Proof | Command / artifact |
|----------|-------|-------------------|
| Catalog → detail → form | Integration ✅ | `IPO Registration Form › catalog → detail → registration form loads` |
| Continue disabled without quantity | Integration ✅ | `continue disabled until quantity entered` |
| Beneficiary + quantity → confirm | Integration ✅ | `form → fill quantity → reach confirm screen` (may skip: no accounts) |
| Confirm → back → form | Integration ✅ | `IPO Registration Confirm › confirm screen → tap back` |
| Selectors tappable (semantics) | Unit + AI UAT | `semantics_labels_test.dart`; UAT label taps |
| Full 4-step submit | AI UAT ○ | explore_prompt primary mission; **known gap** if form non-responsive |

**Known friction (2026-05-29):** AI UAT reported registration form fields/buttons not responding — track in task/UAT report before waiving.

---

## App shell / config

| Behavior | Proof | Command / artifact |
|----------|-------|-------------------|
| Standalone bootstrap | Manual / integration launch | `--dart-define=STANDALONE_ENV=uat` |
| Variant dgo / dstock | Build scripts | `scripts/build_ios_*.sh`, `AppConfig.isDgo` |
| Router initial route | Integration | `--dart-define=STANDALONE_INITIAL_ROUTE=/ipo/catalog` |

---

## Harness / agent infrastructure

| Behavior | Proof | Command / artifact |
|----------|-------|-------------------|
| PM pipeline on code task | Process | `.claude/agents/pm.md` loop completed |
| Intake documented | Doc | Task header: Lane, Risk, Validation |
| AI explorer script | Manual | `bash scripts/ai_test/run_uat.sh --check-only` |

---

## Adding a row

When shipping a new user-visible behavior:

1. Add a row above with behavior + proof level.
2. Add or extend `integration_test/` or `test/` **before** marking task done.
3. If only AI can catch it (animations, coordinate taps), add a note under `scripts/ai_test/explore_prompt.md`.
