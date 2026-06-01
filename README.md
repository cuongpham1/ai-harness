# AI Harness — Bộ công cụ AI cho dự án

Harness tích hợp Claude Code agents, hooks tự động, pipeline review, và **durable layer** từ [harness-experimental](https://github.com/hoangnb24/harness-experimental) vào bất kỳ dự án nào.

## Cài đặt

```bash
bash install.sh [--yes] [--framework <id>] [--name "<tên>"] /đường/dẫn/dự-án
```

Ví dụ:
```bash
bash install.sh --yes --framework nodejs --name "My API" ~/projects/my-api
bash install.sh --yes --framework flutter --name "My App" ~/projects/my-app
bash install.sh ~/projects/existing-app   # merge AGENTS.md, không ghi đè nội dung project
```

**12 framework profiles:** `flutter`, `react`, `nextjs`, `vue`, `nodejs`, `python`, `go`, `rust`, `java`, `csharp`, `php`, `ruby` — xem [frameworks/README.md](frameworks/README.md).

Cập nhật docs/CLI từ upstream (merge, không ghi đè `.claude/`):

```bash
bash scripts/install-harness.sh --merge --yes --directory /đường/dẫn/dự-án
```

## Harness gồm gì?

| Thành phần | Vị trí | Tác dụng |
|-----------|--------|---------|
| Agent definitions | `.claude/agents/` | Định nghĩa PM, coder, reviewer, tester, v.v. |
| Hooks | `scripts/hooks/` | Tự động enforce quy trình |
| HUD | `scripts/hud/` | Status line hiển thị trong Claude Code |
| Knowledge Graph | `scripts/kg.js` | Lưu trữ trạng thái session |
| **Harness CLI** | `scripts/bin/harness-cli` | SQLite durable layer: intake, story, trace, backlog |
| Docs | `docs/` | Quy trình, phân loại, trace spec, maturity |
| Task manager | `.project-manager/` | Quản lý task và handoff |
| Benchmark | `benchmark/` | Harness benchmark tasks |

## Durable layer (harness-cli)

```bash
scripts/bin/harness-cli init              # tạo harness.db
scripts/bin/harness-cli migrate           # schema 002 (story verify_command)
scripts/bin/harness-cli story verify <id> # chạy verify_command của story (CLI 0.1.7)
scripts/bin/harness-cli query matrix      # trạng thái proof
scripts/bin/harness-cli intake ...        # phân loại công việc
scripts/bin/harness-cli trace ...         # ghi trace task
scripts/bin/harness-cli score-trace       # chấm chất lượng trace
scripts/bin/harness-cli query friction    # xem friction patterns
node scripts/friction-by-component.mjs    # group friction by component (H3)
bash scripts/verify-h3.sh                 # verify H3 maturity
bash scripts/verify-story.sh            # H4 lane-aware proof (active task, Stop hooks)
bash scripts/verify-h4.sh                 # H3 + agent parity + H4 gates
bash benchmark/run-harness.sh             # deterministic harness benchmark
```

Chi tiết: `docs/HARNESS.md`, `docs/CURSOR.md`, `docs/TRACE_SPEC.md`, `scripts/README.md`.

## Cursor (full parity)

Cài cùng `install.sh`. Hooks + subagents tự động:

```bash
bash scripts/install-cursor-layer.sh /path/to/project   # nếu project đã có harness
```

Xem [docs/CURSOR.md](docs/CURSOR.md).

## Token efficiency

RTK wrappers, MCP (Cursor vs Claude), lane pipeline: [docs/TOKEN_EFFICIENCY.md](docs/TOKEN_EFFICIENCY.md), [docs/MCP_SETUP.md](docs/MCP_SETUP.md).

## Pipeline (bắt buộc với mọi code change)

```
@coder implement
    ↓
@spec-reviewer — check AC compliance
    ↓ (nếu MISSING/EXTRA → quay lại @coder)
@reviewer — code quality (BLOCKER/MAJOR/MINOR)
    ↓ (nếu BLOCKER → quay lại @coder)
@tester — automated tests + UI verify
    ↓ (nếu critical bug → quay lại @coder)
PM mark DONE ✅
```

## Agents và model

| Agent | Model | Vai trò |
|-------|-------|---------|
| pm | sonnet | Orchestrator — KHÔNG implement trực tiếp |
| coder | sonnet | Implement tất cả code changes |
| spec-reviewer | sonnet | Check spec compliance |
| reviewer | sonnet | Code quality review |
| tester | sonnet | Test plan + UI verify |
| debugger | opus | Root cause analysis |
| solution-architect | opus | Architecture decisions |
| explorer | haiku | Codebase exploration |
| doc-writer | haiku | Documentation |
| planner | sonnet | Issue/task breakdown |
| product-analyst | sonnet | PRD, use cases |

## Hooks tự động

| Hook | Event | Tác dụng |
|------|-------|---------|
| `session-start-pm.js` | SessionStart | Inject task state vào context |
| `block-dangerous-bash.js` | PreToolUse Bash | Block lệnh nguy hiểm |
| `guard-commit.js` | PreToolUse Bash | Block subagent git commit |
| `suggest-compact.js` | PreToolUse (all) | Nhắc /compact sau 50 calls |
| `hud-agent-track.mjs` | SubagentStart/Stop | Track agent activity |
| `subagent-log.js` | SubagentStart/Stop | Log vào kg/runtime/subagent.log |
| `post-tool-task-tracker.js` | PostToolUse Edit/Write | Audit log file edits |
| `post-commit-archaeologist.js` | PostToolUse Bash | Track commits |
| `update-pm-readme.js` | PostToolUse Write | Cập nhật .project-manager/README.md |
| `auto-checkpoint.js` | Stop | Ghi checkpoint khi session kết thúc |
| `check-task-handoff.js` | Stop | Block session end nếu thiếu After-Work |
| `sync-harness-trace.mjs` | Stop | Sync After-Work → harness.db |

## Phân loại công việc (FEATURE_INTAKE.md)

| Lane | Điều kiện | Pipeline |
|------|-----------|---------|
| tiny | 1-2 file, <30 lines | skip review, coder → tester |
| normal | feature mới, 1 module | full pipeline |
| high-risk | cross-module, breaking change | full + architect |

## Unified trace

Task file `### After-Work` → hook `sync-harness-trace.mjs` → `harness.db`. Không cần gọi `harness-cli trace` thủ công.

Stack commands: `docs/*_STACK.md` (theo framework đã chọn khi cài).

## Yêu cầu

- Node.js 18+
- Claude Code CLI (`claude`)
- RTK (recommended): `scripts/rtk-shell.sh`, `rtk-node.sh`, `rtk-python.sh`, `rtk-flutter.sh` — see `docs/TOKEN_EFFICIENCY.md`
- `curl` (để download harness-cli khi cài vào dự án mới)

## Cấu trúc file sau cài đặt

```
your-project/
├── .claude/
│   ├── agents/          # 11 agent definitions
│   └── settings.json    # hooks config
├── scripts/
│   ├── bin/harness-cli  # Rust CLI (gitignored, downloaded on install)
│   ├── schema/          # SQLite migrations
│   ├── hooks/           # 14 hook scripts
│   ├── utils/           # atomic-write.js, kg-paths.js
│   ├── hud/             # HUD components
│   └── kg.js            # knowledge graph
├── docs/
│   ├── HARNESS.md
│   ├── FEATURE_INTAKE.md
│   ├── TRACE_SPEC.md
│   ├── decisions/
│   ├── stories/
│   └── templates/
├── kg/runtime/          # runtime state (gitignored)
├── harness.db           # durable records (gitignored)
├── .project-manager/
│   ├── README.md
│   └── tasks/
└── AGENTS.md
```

## Upstream

Docs và CLI binary theo [harness-experimental](https://github.com/hoangnb24/harness-experimental). ADR hybrid: `docs/decisions/0006-hybrid-claude-code-harness.md`.
