# Go Test

Run Go tests with race detector, vet, and lint.

## Usage
/go-test [package] [filter]

## Steps
1. Vet: `go vet ./...`
2. Run all tests: `go test ./...`
3. With race detector: `go test -race ./...`
4. Specific package: `go test ./internal/service/...`
5. By name filter: `go test -run TestLogin ./...`
6. Verbose: `go test -v ./...`
7. Coverage: `go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out`

## Lint (required before done)
- `golangci-lint run`
- Auto-fix where possible: `golangci-lint run --fix`
- Format: `gofmt -w .` or `goimports -w .`

## Test structure
```go
func TestFunctionName(t *testing.T) {
    // table-driven
    tests := []struct {
        name     string
        input    string
        expected string
    }{
        {"empty input", "", ""},
        {"normal case", "hello", "HELLO"},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := FunctionName(tt.input)
            if got != tt.expected {
                t.Errorf("got %q, want %q", got, tt.expected)
            }
        })
    }
}
```

## Reading output
- Pass: `ok  	github.com/org/repo/pkg	0.XXXs`
- Fail: shows `--- FAIL: TestName` with file:line and values
- Race: `WARNING: DATA RACE` with goroutine stacks

## Common pitfalls
- Not checking returned errors — `go vet` catches some, golangci-lint catches more
- Goroutine leak in tests — use `t.Cleanup()` to close channels/cancel contexts
- Table test loop variable capture (pre-Go 1.22): `tt := tt` inside loop body
