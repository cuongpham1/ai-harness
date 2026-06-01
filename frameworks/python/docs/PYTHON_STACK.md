# Python Stack

Reference for AI agents working on this Python project.

## Overview

Python project. Check `pyproject.toml` for toolchain config (pytest, ruff, mypy, coverage). Virtual environment required — never install globally.

## Project Structure

```
src/
  <package>/
    __init__.py
    models.py
    service.py
    repository.py
    routes.py       # (FastAPI/Flask)
tests/
  conftest.py       # shared fixtures
  test_service.py
  test_repository.py
pyproject.toml      # or setup.py + setup.cfg
.venv/              # virtual environment (gitignored)
```

## Virtual Environment

```bash
python -m venv .venv
source .venv/bin/activate    # macOS/Linux
.venv\Scripts\activate       # Windows

pip install -e ".[dev]"      # install with dev deps
# or
pip install -r requirements-dev.txt
```

## Type Annotations

Required on all public functions and class methods:

```python
from typing import Optional, List
from datetime import datetime

def get_user(user_id: str, include_deleted: bool = False) -> Optional["User"]:
    ...

def list_items(page: int = 1, limit: int = 20) -> List["Item"]:
    ...
```

Use `from __future__ import annotations` at top of file for forward references.

## Async Patterns

```python
import asyncio
from typing import AsyncIterator

async def fetch_items(session: aiohttp.ClientSession, url: str) -> list[dict]:
    async with session.get(url) as resp:
        resp.raise_for_status()
        return await resp.json()

# Context managers
async with asyncio.timeout(30):
    result = await fetch_items(session, url)
```

## Dependency Management

`pyproject.toml` (preferred):
```toml
[project]
name = "myapp"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "sqlalchemy>=2.0",
]

[project.optional-dependencies]
dev = ["pytest", "pytest-asyncio", "pytest-cov", "ruff", "mypy"]
```

## Testing

```python
# tests/conftest.py
import pytest
from myapp.db import get_db

@pytest.fixture
def db():
    conn = create_test_db()
    yield conn
    conn.close()

# tests/test_service.py
import pytest
from unittest.mock import AsyncMock, patch

async def test_get_user_returns_none_when_not_found(db):
    service = UserService(db)
    result = await service.get_user("nonexistent-id")
    assert result is None

@pytest.mark.asyncio
async def test_create_user_stores_in_db(db):
    service = UserService(db)
    user = await service.create_user(email="test@example.com")
    assert user.id is not None
    stored = await db.get_user(user.id)
    assert stored.email == "test@example.com"
```

## Parametrized Tests

```python
@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("", ""),
    ("MiXeD", "MIXED"),
])
def test_uppercase(input: str, expected: str):
    assert uppercase(input) == expected
```

## Error Handling

```python
class AppError(Exception):
    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code
        super().__init__(message)

class NotFoundError(AppError):
    def __init__(self, resource: str, id: str):
        super().__init__(f"{resource} {id!r} not found", "NOT_FOUND")

class ValidationError(AppError):
    def __init__(self, field: str, reason: str):
        super().__init__(f"Validation failed for {field}: {reason}", "VALIDATION_ERROR")
```

## Key Commands

```bash
source .venv/bin/activate    # activate venv
bash scripts/rtk-python.sh test           # filtered pytest output
bash scripts/rtk-python.sh lint           # ruff check (filtered)
pytest                       # fallback
pytest -v -k "test_login"    # filtered tests
pytest --cov=src --cov-report=term-missing  # with coverage
ruff check .                 # lint
ruff format .                # format
mypy .                       # type check
rtk git diff                 # when RTK CLI installed
```

## Common Pitfalls

- `import` at module level in test file without mocking → real side effects run
- Missing `await` on coroutine → coroutine object returned, not result
- `datetime.now()` in production code → hard to test; inject via parameter or `datetime.utcnow`
- Mutable default arguments `def f(items=[])` → shared across calls, use `None` and initialize in body
- `mypy` `Any` type → trace the actual type and annotate properly
