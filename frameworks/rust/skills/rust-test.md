# Rust Test

Run Rust tests with Clippy, format check, and cargo test.

## Usage
/rust-test [filter]

## Steps
1. Check format: `cargo fmt --check`
2. Auto-format: `cargo fmt`
3. Lint: `cargo clippy -- -D warnings`
4. Run tests: `cargo test`
5. Run specific test: `cargo test test_name`
6. Run with output: `cargo test -- --nocapture`
7. Run doc tests only: `cargo test --doc`

## Build modes
- Debug build: `cargo build`
- Release build: `cargo build --release`
- Check without build artifact: `cargo check`

## Test structure
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_behavior() {
        assert_eq!(func(input), expected);
    }

    #[test]
    #[should_panic(expected = "error message")]
    fn test_panics() { ... }
}
```

## Integration tests
- Live in `tests/` directory
- Each file is a separate test binary
- Run: `cargo test --test integration_test_name`

## Reading output
- Pass: `test result: ok. X passed; 0 failed`
- Fail: shows test name, thread panicked, assertion failure with values
- Clippy: shows lint with file:line and explanation

## Common pitfalls
- `.unwrap()` in production code — Clippy flags it, fix with `?` or explicit match
- Missing lifetime annotations — compiler error shows exact location
- Dead code warnings become errors under `-D warnings` — remove or `#[allow(dead_code)]` with comment
