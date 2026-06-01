<!-- FRAMEWORK:BEGIN id=go -->
## Go Stack

This project uses Go. Additional rules:

| Doc | When to read |
|-----|-------------|
| docs/GO_STACK.md | Before any Go implementation |

### Test commands
- Unit: `go test ./...`
- With race detector: `go test -race ./...`
- Coverage: `go test -coverprofile=coverage.out ./...`
- Lint: `golangci-lint run`

### Framework rules
- Always run `go vet ./...` and `golangci-lint run` before marking task done
- Test files are `*_test.go` in the same package
- Use table-driven tests for multiple cases
- Handle all errors explicitly — never `_` discard an error from a fallible call
- Package names are lowercase, single word — no underscores

### Skills available
- `/go-test` — run go test with race detector and vet
<!-- FRAMEWORK:END -->
