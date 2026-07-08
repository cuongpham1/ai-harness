# AI Harness — Bộ khung vận hành AI cho dự án phần mềm

**Repository:** [github.com/cuongpham1/ai-harness](https://github.com/cuongpham1/ai-harness)

Repo này là **bộ cài đặt (installer)** — không phải ứng dụng chạy trực tiếp. Chạy `install.sh` để gắn quy trình agent, hooks, tài liệu và lớp dữ liệu bền (`harness.db`) vào **dự án đích** của bạn. Kết hợp [repository-harness](https://github.com/hoangnb24/repository-harness) (CLI, trace, maturity) với pipeline đa agent (Claude Code + Cursor).

---

## Repo này làm được gì?

| Khả năng | Mô tả ngắn |
|----------|------------|
| **Cài harness vào project** | Một lệnh: agents, hooks, docs, CLI, 12 stack framework |
| **Pipeline bắt buộc** | coder → spec-reviewer → reviewer → tester (PM điều phối) |
| **Phân loại rủi ro** | Lane `tiny` / `normal` / `high-risk` — biết khi nào review đầy đủ |
| **Task + handoff** | File `.project-manager/tasks/*.md`, After-Work, hook chặn thiếu handoff |
| **Trace tự động** | After-Work → sync → `harness.db` + `score-trace` |
| **Verify tự động (H4)** | Khi `Outcome: completed` → lint/test theo stack + `proof` trong DB |
| **CLI durable** | intake, story, decision, backlog, trace, query (SQLite) |
| **Cursor + Claude** | Cùng quy trình; kiểm tra parity agent trong CI |
| **Benchmark harness** | Đo compliance harness (không phụ thuộc app của bạn) |

**Không làm:** scaffold code ứng dụng, deploy, thay CI/CD của product — chỉ **vận hành AI** trong repo.

---

## Ai nên dùng?

- Team dùng **Claude Code** và/hoặc **Cursor** với agent/subagent.
- Muốn agent **không “xong ảo”** — có proof, trace, task file làm nguồn sự thật.
- Dự án Node, Python, Flutter, Rust, v.v. (12 profile) hoặc generic (ít verify stack).

---

## Cài đặt nhanh

### Yêu cầu

- **Node.js 18+**
- **curl** (tải `harness-cli` khi cài project mới)
- **Claude Code** và/hoặc **Cursor** (tùy IDE)
- Tùy chọn: **Rust/cargo** (build CLI local nếu không tải được binary)

### Cài vào dự án đích

```bash
git clone https://github.com/cuongpham1/ai-harness.git ai-harness
cd ai-harness

bash install.sh --yes --framework nodejs --name "Tên dự án" /đường/dẫn/dự-án-của-bạn
```

**Framework** (auto-detect hoặc `--framework`):  
`nodejs`, `react`, `nextjs`, `vue`, `flutter`, `python`, `go`, `rust`, `java`, `csharp`, `php`, `ruby` — chi tiết [frameworks/README.md](frameworks/README.md).

**Upgrade** (đã có harness):

```bash
bash scripts/upgrade.sh /đường/dẫn/dự-án              # thêm file mới + merge hooks
bash scripts/sync-harness-layer.sh /đường/dẫn/dự-án   # refresh hooks/agents (solo-dev, giữ .gitignore)
bash scripts/rebuild-harness-cli.sh                   # CLI mới (query cost, …)
node scripts/hooks/update-pm-readme.js --refresh-all  # sync README từ task statuses
```

Hoặc merge cài đặt gốc:

```bash
bash install.sh --yes /đường/dẫn/dự-án   # merge, không ghi đè file cũ
```

**Chỉ cập nhật docs/CLI từ upstream** (giữ `.claude/` hiện có):

```bash
bash scripts/install-harness.sh --merge --yes --directory /đường/dẫn/dự-án
```

Sau cài, trong **dự án đích** có: `.claude/`, `.cursor/`, `scripts/`, `docs/`, `.project-manager/`, `frameworks/<id>/profile.json`, `harness.db` (local, gitignored).

---

## Quy trình hàng ngày

### 1. Nhận việc → tạo task

Tạo file theo [docs/templates/task.md](docs/templates/task.md):

```text
.project-manager/tasks/task-042.md
```

Ghi rõ: **Lane**, AC, scope, **Story ID** (nếu có).

### 2. Chọn lane ([docs/FEATURE_INTAKE.md](docs/FEATURE_INTAKE.md))

| Lane | Khi nào | Pipeline |
|------|---------|----------|
| **tiny** | 1–2 file, thay đổi nhỏ | coder → tester (bỏ review đầy đủ) |
| **normal** | Feature thường | coder → spec-reviewer → reviewer → tester |
| **high-risk** | Auth, breaking API, kiến trúc | Như normal + architect + ADR |

### 3. Implement (delegate subagent)

Trong Claude/Cursor, **PM không code trực tiếp** — giao `@coder` (hoặc subagent `coder`) theo task file.

Đọc stack: `.harness-profile` + `docs/*_STACK.md` (ví dụ `docs/NODEJS_STACK.md`).

### 4. Kết thúc phiên — After-Work (bắt buộc)

Append vào task file:

```markdown
### After-Work — 2026-06-01
**Agent:** coder
**Outcome:** completed
**Done:** Mô tả ≥10 ký tự những gì đã làm
**Files changed:** src/a.ts, src/b.ts
**Errors:** none
**Friction:** none
**Story ID:** US-042
```

**Chỉ khi `Outcome: completed`** hook mới chạy lint/test (lane normal/high-risk).

Hook Stop tự động (không cần nhớ từng lệnh):

1. Kiểm tra handoff  
2. Sync trace → `harness.db`  
3. `score-trace`  
4. **verify** (`verify-story.sh`)  
5. Sync story status  
6. Checkpoint  

Chi tiết: [docs/HARNESS_VERIFICATION.md](docs/HARNESS_VERIFICATION.md).

### 5. PM đánh dấu task xong

Cập nhật `**Status:** done` trong task file sau khi pipeline + verify pass.

---

## Lệnh `harness-cli` (trong dự án đã cài)

Binary: `scripts/bin/harness-cli` (release pin **0.1.11** hoặc build local qua `scripts/rebuild-harness-cli.sh`).

**Có sẵn hôm nay:**

```bash
cd /đường/dẫn/dự-án-đã-cài

scripts/bin/harness-cli init
scripts/bin/harness-cli migrate
scripts/bin/harness-cli query stats
scripts/bin/harness-cli query cost        # token coverage + USD estimate (cần build local)
scripts/bin/harness-cli query matrix
scripts/bin/harness-cli query friction
scripts/bin/harness-cli query backlog
scripts/bin/harness-cli query traces
scripts/bin/harness-cli score-trace
```

| Nhóm lệnh | Ví dụ |
|-----------|--------|
| **intake** | `intake --type change_request --summary "..." --lane normal` |
| **story** | `story add`, `story update --unit 1`, `story verify US-001` |
| **decision** | `decision add`, `decision verify ADR-001` |
| **trace** | `trace --summary "..." --agent coder --outcome completed` |
| **score-trace** | Chấm trace mới nhất theo [TRACE_SPEC](docs/TRACE_SPEC.md) |
| **backlog** | Ghi đề xuất cải thiện harness |
| **query** | matrix, backlog, traces, friction, cost, stats, sql |

**Phase 5 (docs/spec — chưa trong binary hiện tại):** `score-context`, `tool register`, `intervention add`, `query tools`, `query interventions`, `audit`, `propose`. Xem [docs/TOOL_REGISTRY.md](docs/TOOL_REGISTRY.md), [PHASE5.md](PHASE5.md).

**Lưu ý:** Proof flags dùng số: `--unit 1 --integration 1`, **không** dùng `yes`/`no`.

Trace từ task file thường **tự sync** — không cần `trace` thủ công mỗi lần.

---

## Verify & chất lượng harness

| Lệnh | Mục đích |
|------|----------|
| `bash scripts/verify-story.sh` | Lint/test task đang active (framework profile) |
| `bash scripts/verify-h4.sh` | Gate H3 + parity agent + H4 |
| `bash scripts/verify-h3.sh` | Benchmark + friction + score-trace |
| `node scripts/check-agent-parity.mjs` | `.claude` vs `.cursor` agents khớp body |

**Hai lớp verify:**

1. **Hooks + `verify-story.sh`** — lệnh test/lint trong `frameworks/<id>/profile.json`  
2. **`harness-cli story verify`** — chạy `verify_command` lưu trong DB cho từng story  

---

## Claude Code vs Cursor

| | Claude Code | Cursor |
|---|-------------|--------|
| Config | `.claude/settings.json` | `.cursor/hooks.json` |
| Agents | `.claude/agents/` | `.cursor/agents/` (sync từ Claude) |
| Context shrink | `/compact` + `suggest-compact.js` | New Agent chat + `context-nudge.mjs` (warn-only) |
| HUD | `scripts/hud/` | — |

Cài Cursor layer riêng nếu cần:

```bash
bash scripts/install-cursor-layer.sh /đường/dẫn/dự-án
```

Xem [docs/CURSOR.md](docs/CURSOR.md).

**GitHub Copilot / Codex** — không có hooks; dùng [`.github/copilot-instructions.md`](.github/copilot-instructions.md) + [docs/CODEX.md](docs/CODEX.md) (workflow thủ công, `harness-cli trace` sau mỗi task).

---

## Cấu trúc sau khi cài (dự án đích)

```text
your-project/
├── .claude/agents/          # pm, coder, reviewer, tester, …
├── .cursor/                 # hooks, rules, subagents
├── scripts/
│   ├── bin/harness-cli      # gitignored — tải khi install
│   ├── hooks/               # handoff, trace, verify, …
│   └── schema/              # 001-init.sql, 002-story-verify.sql
├── frameworks/<id>/
│   └── profile.json         # lint_cmd, test_cmd (cho verify-story)
├── docs/                    # HARNESS, FEATURE_INTAKE, *_STACK.md
├── .project-manager/tasks/
├── .harness-profile         # id framework
├── harness.db               # gitignored
└── AGENTS.md                # hướng dẫn agent
```

---

## Phát triển repo installer này

Clone repo **ai-harness** (không phải thư mục app):

```bash
bash scripts/rebuild-harness-cli.sh      # cài rustup + build nếu cần
bash scripts/verify-h4.sh
node scripts/check-agent-parity.mjs
```

**Maturity:** H3 đạt, H4 thin slice — [docs/HARNESS_MATURITY.md](docs/HARNESS_MATURITY.md).

---

## Tài liệu quan trọng

| Tài liệu | Nội dung |
|----------|----------|
| [docs/HARNESS.md](docs/HARNESS.md) | Mô hình task loop, trace |
| [docs/FEATURE_INTAKE.md](docs/FEATURE_INTAKE.md) | Lane tiny/normal/high-risk |
| [docs/HARNESS_VERIFICATION.md](docs/HARNESS_VERIFICATION.md) | Verify, `proof`, hooks |
| [docs/CURSOR.md](docs/CURSOR.md) | Cursor parity |
| [docs/CODEX.md](docs/CODEX.md) | Copilot/Codex (manual workflow) |
| [docs/TOKEN_EFFICIENCY.md](docs/TOKEN_EFFICIENCY.md) | RTK, MCP |
| [docs/LANGFUSE.md](docs/LANGFUSE.md) | Export trace ra Langfuse (prod observability/cost) |
| [scripts/README.md](scripts/README.md) | CLI + scripts chi tiết |
| [docs/decisions/0006-hybrid-claude-code-harness.md](docs/decisions/0006-hybrid-claude-code-harness.md) | Vì sao hybrid |

---

## Profile Manifest

The harness tracks installed framework profiles in `kg/runtime/installed-profiles.json` (gitignored, like `harness.db`). This prevents accidental duplicate installs when `install.sh` or `link-install.sh` is re-run on the same target.

### View installed profiles

```bash
# In the target project directory:
node scripts/list-profiles.mjs           # pretty-print
node scripts/list-profiles.mjs --json    # JSON output
```

### Force reinstall

```bash
bash install.sh --force --framework nodejs /path/to/project
bash link-install.sh --force /path/to/project
```

Without `--force`, re-running install on a target that already has a profile registered will print a warning and skip the framework install step. Core harness files (agents, hooks, docs) are still updated.

### Manifest schema

```json
{
  "updated": "ISO date",
  "profiles": [
    {
      "profile_id": "swift",
      "installed_at": "2026-06-04T...",
      "version": "unknown",
      "target_dir": "/abs/path/to/project",
      "install_mode": "copy|symlink",
      "checksum": "sha256 of profile.json",
      "status": "installed|removed"
    }
  ]
}
```

---

## Security — AgentShield

AgentShield is a static adversarial security scanning skill built into the harness.

### Quick scan

```bash
node scripts/security-shield.mjs --scope all --output file
# Writes: docs/security-audit-{YYYY-MM-DD}.md
```

### Scope options

| Scope | What is scanned |
|-------|----------------|
| `hooks` | `scripts/hooks/` — eval, execSync, shell injection vectors |
| `mcp` | `.claude/settings.json` mcpServers — uncapped access, suspicious commands |
| `secrets` | All config/code files — 14 secret patterns (API keys, tokens, private keys, JWTs, …) |
| `agents` | `.claude/agents/` and `.claude/skills/` — instruction injection, privilege escalation |
| `all` | All of the above |

### 3-agent adversarial pattern

For deep scanning, invoke the `/agent-shield` skill (`.claude/skills/agent-shield.md`):
- **Attacker agent** — finds exploit chains across all surfaces
- **Defender agent** — evaluates real exploitability (eliminates theoretical/false positives)
- **Auditor agent** — synthesises confirmed findings into actionable `docs/security-audit-{date}.md`

### Integration with apply-proposal.sh

`scripts/apply-proposal.sh` automatically runs the shield scan before applying any `risk=high` proposal. If HIGH severity issues are found, the apply is blocked until they are resolved. Use `--skip-shield` to bypass (not recommended).

```bash
bash scripts/apply-proposal.sh --id PROP-001 --approve-risk=high             # runs shield
bash scripts/apply-proposal.sh --id PROP-001 --approve-risk=high --skip-shield  # bypasses shield
```

---

## Upstream

CLI và nhiều doc theo [repository-harness](https://github.com/hoangnb24/repository-harness) (release [harness-cli-v0.1.11](https://github.com/hoangnb24/repository-harness/releases/tag/harness-cli-v0.1.11)). Repo **ai-harness** thêm: 12 framework, `install.sh`, Cursor layer, `verify-story.sh`, benchmark installer.

---

## Agents (trong dự án đã cài)

| Agent | Vai trò |
|-------|---------|
| **pm** | Điều phối — không implement code |
| **coder** | Mọi thay đổi code |
| **spec-reviewer** | Đúng AC |
| **reviewer** | Chất lượng code |
| **tester** | Test + QA |
| **debugger** | Khi kẹt ≥2 vòng |
| **solution-architect** | High-risk / kiến trúc |
| **explorer** | Khảo sát codebase |

Định nghĩa: `.claude/agents/*.md` (Cursor sync qua `scripts/sync-cursor-agents.mjs`).

---

## Checklist “xong việc” cho agent

| Lane | Trước khi stop session |
|------|------------------------|
| **tiny** | After-Work đủ field, Friction có tag hoặc `none` |
| **normal** | Full pipeline + `Outcome: completed` → verify pass |
| **high-risk** | + ADR `docs/decisions/` nếu cần |

Xem block trong [templates/AGENTS.harness-block.md](templates/AGENTS.harness-block.md) (merge vào `AGENTS.md` khi cài).
