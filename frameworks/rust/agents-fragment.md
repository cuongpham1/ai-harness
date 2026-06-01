<!-- FRAMEWORK:BEGIN id=rust -->
## Rust Stack

This project uses Rust. Additional rules:

| Doc | When to read |
|-----|-------------|
| docs/RUST_STACK.md | Before any Rust implementation |

### Test commands
- Unit: `cargo test`
- With output: `cargo test -- --nocapture`
- Doc tests: included in `cargo test`
- Lint: `cargo clippy -- -D warnings`

### Framework rules
- Always run `cargo clippy -- -D warnings` and `cargo fmt --check` before marking task done
- Use `#[cfg(test)]` modules in the same file for unit tests
- Integration tests live in `tests/`
- Handle `Result`/`Option` explicitly — no `.unwrap()` in production code
- Use `thiserror` for library errors, `anyhow` for binary errors

### Skills available
- `/rust-test` — run cargo test with clippy and fmt check
<!-- FRAMEWORK:END -->
