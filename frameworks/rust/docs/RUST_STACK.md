# Rust Stack

Reference for AI agents working on this Rust project.

## Overview

Rust project. Check `Cargo.toml` for workspace layout, edition (2021 required), and key dependencies. Async runtime: Tokio (check `tokio` in deps).

## Project Structure

```
src/
  main.rs           # binary entry point
  lib.rs            # library root (if also a lib crate)
  error.rs          # error types
  config.rs         # config loading
  domain/           # core types and traits
  infra/            # external system adapters (DB, HTTP)
  handlers/         # HTTP handlers (Axum/Actix)
tests/              # integration tests
  integration_test.rs
benches/            # criterion benchmarks
Cargo.toml
Cargo.lock          # commit this for binaries, gitignore for libs
```

## Workspace Layout (if monorepo)

```toml
# Cargo.toml (workspace root)
[workspace]
members = ["crates/core", "crates/cli", "crates/server"]
resolver = "2"

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
```

## Error Handling

Library crates: use `thiserror`
```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("not found: {id}")]
    NotFound { id: String },
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("validation failed: {field} — {reason}")]
    Validation { field: String, reason: String },
}
```

Binary crates: use `anyhow`
```rust
use anyhow::{Context, Result};

fn load_config(path: &str) -> Result<Config> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read config from {path}"))?;
    toml::from_str(&content).context("failed to parse config")
}
```

Never use `.unwrap()` in production code. Use `?` operator or explicit `match`.

## Async Patterns (Tokio)

```rust
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = load_config("config.toml")?;
    let db = Database::connect(&config.database_url).await?;
    let server = Server::new(db);
    server.run(config.port).await
}

// Concurrent tasks
let (result_a, result_b) = tokio::join!(fetch_a(), fetch_b());

// Spawn background task
tokio::spawn(async move {
    if let Err(e) = background_job().await {
        tracing::error!("background job failed: {e}");
    }
});
```

## Testing

Unit tests in same file:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_id_returns_uuid() {
        let id = parse_id("550e8400-e29b-41d4-a716-446655440000").unwrap();
        assert_eq!(id.to_string(), "550e8400-e29b-41d4-a716-446655440000");
    }

    #[test]
    fn parse_invalid_id_returns_error() {
        let result = parse_id("not-a-uuid");
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn async_service_returns_item() {
        let repo = MockRepo::new();
        let service = Service::new(repo);
        let item = service.get("id-1").await.unwrap();
        assert_eq!(item.id, "id-1");
    }
}
```

Integration tests in `tests/`:
```rust
// tests/api_test.rs
use myapp::create_app;

#[tokio::test]
async fn health_check_returns_200() {
    let app = create_app(test_config()).await;
    let response = app.oneshot(Request::get("/health").body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}
```

## Key Commands

```bash
cargo check                    # fast type check, no binary
cargo build                    # debug build
cargo build --release          # release build
cargo run                      # build and run
cargo test                     # all tests
cargo test -- --nocapture      # with println! output
cargo clippy -- -D warnings    # lint, fail on warnings
cargo fmt                      # format
cargo fmt --check              # check format (CI)
cargo doc --open               # build and open docs
```

## Clippy Enforcement

Must pass before task done:
```bash
cargo clippy -- -D warnings
```

Common Clippy fixes:
- `needless_return` → remove `return` keyword
- `unwrap_used` → use `?` or `expect` with message
- `clone_on_copy` → remove `.clone()` on Copy types
- `match_bool` → use `if/else` instead of `match` on bool

## Common Pitfalls

- `.unwrap()` on `Option`/`Result` in non-test code → Clippy flags it; use `?` or `expect("reason")`
- Cloning unnecessarily in hot path → check if reference works
- Holding `MutexGuard` across `.await` → deadlock; drop before await
- `String` vs `&str` confusion → prefer `&str` for function params, `String` for owned data
- Missing `Send + Sync` bounds on trait objects used with Tokio → compiler error, add `+ Send + Sync`
