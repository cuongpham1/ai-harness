# Go Stack

Reference for AI agents working on this Go project.

## Overview

Go project. Check `go.mod` for module name and Go version (1.21+ required). HTTP framework: net/http stdlib, Chi, Gin, or Echo — check `go.mod` imports.

## Project Structure

```
cmd/
  server/
    main.go           # binary entry point
internal/             # private packages (not importable externally)
  domain/             # core types, interfaces
  service/            # business logic
  repository/         # data access
  handler/            # HTTP handlers
  middleware/         # HTTP middleware
pkg/                  # public packages (importable by external code)
  config/
  logger/
go.mod
go.sum
Makefile              # common targets
```

## Package Conventions

- Package names: lowercase, single word, no underscores (`userservice` not `user_service`)
- Package name = last segment of import path
- `internal/` prevents external import — use for app-private code
- Avoid `util`, `common`, `helper` package names — name by responsibility

## HTTP Handlers (stdlib/Chi)

```go
// internal/handler/item_handler.go
package handler

import (
    "encoding/json"
    "net/http"

    "github.com/org/app/internal/service"
)

type ItemHandler struct {
    svc service.ItemService
}

func NewItemHandler(svc service.ItemService) *ItemHandler {
    return &ItemHandler{svc: svc}
}

func (h *ItemHandler) List(w http.ResponseWriter, r *http.Request) {
    items, err := h.svc.List(r.Context())
    if err != nil {
        http.Error(w, "internal server error", http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(items)
}
```

## Error Handling

Never discard errors. Wrap with context:
```go
import "fmt"

func (s *ItemService) GetItem(ctx context.Context, id string) (*Item, error) {
    item, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("ItemService.GetItem: %w", err)
    }
    if item == nil {
        return nil, ErrNotFound
    }
    return item, nil
}

// Sentinel errors
var (
    ErrNotFound   = errors.New("not found")
    ErrForbidden  = errors.New("forbidden")
)

// Check: errors.Is(err, ErrNotFound)
```

## Interfaces

Define interfaces at the point of use (consumer), not at implementation:
```go
// internal/service/item_service.go
type ItemRepository interface {
    FindByID(ctx context.Context, id string) (*Item, error)
    List(ctx context.Context) ([]*Item, error)
    Save(ctx context.Context, item *Item) error
}
```

## Concurrency

```go
// Fan-out with errgroup
import "golang.org/x/sync/errgroup"

g, ctx := errgroup.WithContext(ctx)
g.Go(func() error { return fetchA(ctx) })
g.Go(func() error { return fetchB(ctx) })
if err := g.Wait(); err != nil { return err }

// Channel pipeline
func generate(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums { out <- n }
        close(out)
    }()
    return out
}
```

Always cancel contexts: `ctx, cancel := context.WithTimeout(ctx, 5*time.Second); defer cancel()`

## Testing

Table-driven tests:
```go
func TestUppercase(t *testing.T) {
    tests := []struct {
        name     string
        input    string
        expected string
    }{
        {"empty", "", ""},
        {"lowercase", "hello", "HELLO"},
        {"mixed", "Hello World", "HELLO WORLD"},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Uppercase(tt.input)
            if got != tt.expected {
                t.Errorf("Uppercase(%q) = %q, want %q", tt.input, got, tt.expected)
            }
        })
    }
}
```

HTTP handler test:
```go
func TestItemHandler_List(t *testing.T) {
    mockSvc := &MockItemService{items: []*Item{{ID: "1", Name: "Test"}}}
    h := NewItemHandler(mockSvc)

    req := httptest.NewRequest(http.MethodGet, "/items", nil)
    w := httptest.NewRecorder()
    h.List(w, req)

    resp := w.Result()
    if resp.StatusCode != http.StatusOK {
        t.Fatalf("expected 200, got %d", resp.StatusCode)
    }
}
```

## Key Commands

```bash
go mod tidy              # sync go.sum with imports
go build ./...           # build all packages
go run .                 # run main package
go test ./...            # all tests
go test -race ./...      # with race detector
go test -v -run TestName # specific test
go vet ./...             # vet
golangci-lint run        # lint
gofmt -w .               # format (or goimports -w .)
go doc package.Function  # docs
```

## Common Pitfalls

- Ignoring returned error (`_, err = f()` where err check is missing) → silent failure; `go vet` catches some
- Loop variable capture (pre-Go 1.22): `for _, v := range items { go func() { use(v) }() }` → `v` is captured by reference; fix: `v := v` inside loop body or upgrade to Go 1.22+
- Nil pointer dereference on interface: check `if x == nil` before method call on interface value
- Context not propagated to DB/HTTP calls → timeouts not respected; always pass `ctx`
- `http.ResponseWriter` written after handler returns → second write is no-op but logs warning; return immediately after writing error
