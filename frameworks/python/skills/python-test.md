# Python Test

Run Python tests with pytest, type checking, and lint.

## Usage
/python-test [filter] [--coverage]

## Steps
1. Activate venv if needed: `source .venv/bin/activate` or `source venv/bin/activate`
2. Run all tests: `pytest`
3. Run specific file: `pytest tests/test_service.py`
4. Run by name filter: `pytest -k "test_login"`
5. With coverage: `pytest --cov=src --cov-report=term-missing`
6. Verbose output: `pytest -v`

## Lint and type check (required before done)
- Lint: `ruff check .`
- Auto-fix: `ruff check . --fix`
- Type check: `mypy .`
- Format: `ruff format .`

## Test structure
- Files: `tests/test_<module>.py`
- Functions: `def test_<behavior>():`
- Classes: `class Test<Feature>:` (no `__init__`)
- Fixtures: defined with `@pytest.fixture` in `conftest.py`

## Reading output
- Pass: `X passed in Xs`
- Fail: shows test name, file:line, AssertionError with diff
- Coverage: table shows missing lines per module

## Common patterns
- Mock external calls: `@patch('module.external_call')`
- Async tests: `@pytest.mark.asyncio` with `async def test_...()`
- Parametrize: `@pytest.mark.parametrize("input,expected", [...])`
