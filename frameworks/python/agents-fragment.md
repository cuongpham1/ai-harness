<!-- FRAMEWORK:BEGIN id=python -->
## Python Stack

This project uses Python. Additional rules:

| Doc | When to read |
|-----|-------------|
| docs/PYTHON_STACK.md | Before any Python implementation |

### Test commands
- Unit: `pytest`
- With coverage: `pytest --cov`
- Type check: `mypy .`
- Lint: `ruff check .`

### Framework rules
- Always run `ruff check .` and `mypy .` before marking task done
- Tests live in `tests/` mirroring `src/` structure
- Use type annotations on all public functions and class methods
- Prefer `pyproject.toml` over `setup.py` for new projects
- Virtual environment must be active — never install globally

### Skills available
- `/python-test` — run pytest with filtered output
<!-- FRAMEWORK:END -->
