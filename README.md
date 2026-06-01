# AI Harness — Bộ công cụ AI cho dự án

Harness tích hợp Claude Code agents, hooks tự động, và pipeline review vào bất kỳ dự án nào.

## Cài đặt

```bash
bash install.sh /đường/dẫn/dự-án
```

Ví dụ:
```bash
bash install.sh ~/projects/my-flutter-app
bash install.sh ~/projects/my-node-api
```

## Harness gồm gì?

| Thành phần | Vị trí | Tác dụng |
|-----------|--------|---------|
| Agent definitions | `.claude/agents/` | Định nghĩa PM, coder, reviewer, tester, v.v. |
| Hooks | `scripts/hooks/` | Tự động enforce quy trình |
| HUD | `scripts/hud/` | Status line hiển thị trong Claude Code |
| Knowledge Graph | `scripts/kg.js` | Lưu trữ trạng thái session |
| Docs | `docs/` | Quy trình, phân loại, test matrix |
| Task manager | `.project-manager/` | Quản lý task và handoff |

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
| `check-task-handoff.js` | Stop | Block session end nếu thiếu After-Work note |

## Phân loại công việc (FEATURE_INTAKE.md)

| Lane | Điều kiện | Pipeline |
|------|-----------|---------|
| tiny | 1-2 file, <30 lines | skip review, coder → tester |
| normal | feature mới, 1 module | full pipeline |
| high-risk | cross-module, breaking change | full + architect |

## Flutter commands (nếu cài Flutter mode)

```bash
bash scripts/rtk-flutter.sh test       # filtered (~80% token savings)
bash scripts/rtk-flutter.sh analyze    # filtered (~70% token savings)
bash scripts/rtk-flutter.sh pub get    # filtered (~90% token savings)
flutter test                           # raw output (debug)
```

## Yêu cầu

- Node.js 18+
- Claude Code CLI (`claude`)
- RTK (khuyến nghị): token savings cho git/find/cat/grep

## Cấu trúc file sau cài đặt

```
your-project/
├── .claude/
│   ├── agents/          # 11 agent definitions
│   └── settings.json    # hooks config
├── scripts/
│   ├── hooks/           # 14 hook scripts
│   ├── utils/           # atomic-write.js, kg-paths.js
│   ├── hud/             # HUD components
│   └── kg.js            # knowledge graph
├── docs/
│   ├── HARNESS.md
│   ├── FEATURE_INTAKE.md
│   ├── TEST_MATRIX.md
│   └── templates/task.md
├── kg/runtime/          # runtime state (gitignored)
├── .project-manager/
│   ├── README.md
│   └── tasks/
└── AGENTS.md
```
