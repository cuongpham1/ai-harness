# Framework Profiles

12 stack profiles installed via `bash install.sh`. Auto-detection runs in priority order below.

| ID | Display | Detect files |
|----|---------|--------------|
| `nextjs` | Next.js | `next.config.*` |
| `vue` | Vue.js | `vite.config.*`, `vue.config.js` |
| `flutter` | Flutter | `pubspec.yaml`, `lib/main.dart` |
| `react` | React | `package.json`, `src/App.tsx` |
| `java` | Java | `pom.xml`, `build.gradle*` |
| `csharp` | C# .NET | `Program.cs`, `global.json` |
| `rust` | Rust | `Cargo.toml`, `src/main.rs` |
| `go` | Go | `go.mod`, `main.go` |
| `python` | Python | `pyproject.toml`, `requirements.txt` |
| `nodejs` | Node.js | `package.json`, `tsconfig.json` |
| `php` | PHP | `composer.json`, `artisan` |
| `ruby` | Ruby | `Gemfile`, `config.ru` |

Each profile adds:

- `docs/*_STACK.md` — commands and structure
- `agents-fragment.md` → merged into `AGENTS.md`
- `context-rules-patch.md` → appended to `docs/CONTEXT_RULES.md`
- Skills → `.claude/skills/` via `scripts/install-skills.sh`

Force a profile:

```bash
bash install.sh --yes --framework python --name "My App" /path/to/project
```

Generic (no stack doc): choose **Generic** in the installer menu or use a profile that does not match detect files.
