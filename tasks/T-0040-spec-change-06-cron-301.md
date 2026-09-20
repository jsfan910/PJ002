---
id: T-0040
title: 規格變更請求：06 cron 定位改「保溫與人工抽查」、secret 版本釘選文字、D-016 301→3xx
epic: E-001
team: plan
role: plan-sd
model: opus
phase: plan
status: todo
round: 1
depends_on: [T-0039]
inputs:
  - docs/reports/20260920-1806-測試總結-E001-r3.md#6（裁決事項 C：cron 24 小時內僅 8 次，備援名不副實）
  - tasks/E-001-todo-app.md（2026-09-20T18:18:13 裁決：C 採選項 1；使用者 Gate 2 r2 裁決）
  - docs/specs/06_部署架構與CICD.md#2、#3.3、#6.1、#6.8（現行 cron 與 uptime check 的定位文字）
  - docs/specs/24_缺陷清單.md#D-016（301 → 3xx 文字建議與涉及位置）
  - docs/specs/adr/ADR-0005-雲端平台-CloudRun.md（決定第 7 點「Google 前端固定回 301」）
  - docs/specs/01_需求規格書_SRS.md（若有「301」字面）
  - T-0039 的 outputs 與交接檔（secret 版本釘選實作結果）
outputs:
  - docs/specs/06_部署架構與CICD.md（§2 資源表、§3.2 deploy／verify 敘述、§3.3、§4、§6.1；版本 0.2 → 0.3，文末變更紀錄）
  - docs/specs/adr/ADR-0005-雲端平台-CloudRun.md（決定第 7 點附註）
  - docs/specs/01_需求規格書_SRS.md（僅在含「301」字面時修正）
acceptance:
  - 06 §6.1／§3.3：NFR-003 主要來源明寫 Cloud Monitoring uptime check；`monitor-health.yml` cron 定位改為「保溫與人工抽查用，不具備援能力」，並寫明理由（實測 24 小時 8 次／理論 258 次）；提出「第二個 uptime check 作為真備援」的建議與代價（免費額度、告警重複）供 Leader 裁決，不自行決定
  - 06 §3.2／§4：`--set-secrets` 改為具體版本號的敘述與 T-0039 實作一致（版本號來源、STEP_SUMMARY 記錄、覆寫變數名稱）；§2 表「HTTP 請求由 Google 前端 301 導向 HTTPS」改為「3xx（實測 302）」
  - ADR-0005 第 7 點加附註：實測 302，判準改「3xx 且 Location 為 https」，引用 D-016 與 Leader 2026-09-19T17:30:10 裁決
  - 06 frontmatter `version: 0.3`、`updated` 更新，文末變更紀錄新增一列（含本卡編號與三項變更）
  - 不改 20_測試案例.md（TC-079 判準文字由 qa-lead 於下一輪測試計畫同步卡處理，本卡在交接檔「下一步建議」註明）
reviewer: leader
branch: null
created: 2026-09-20T18:35:00+08:00
updated: 2026-09-20T18:35:00+08:00
blocked_reason: null
---

## 目標

把三件「文件與事實不符」收斂到凍結規格：cron 不是備援、secret 不再用 latest、HTTPS 導向不是固定 301。屬規格變更請求（Gate 1 後凍結規格的正規變更途徑）。

## 背景與限制

- 上游：T-0037 裁決事項 C（Leader 採選項 1）、D-016（Leader 列 P1 規格變更請求）、T-0039（機制實作）。
- 下游：T-0042 Release Notes；日後測試計畫同步卡（qa-lead 改 TC-079 判準）。
- 必須遵守：CLAUDE.md 協作協定；角色檔 `.claude/agents/plan-sd.md`；文件卡直接在 main 作業。

## 驗收方式

Leader：

```bash
grep -n "latest" docs/specs/06_部署架構與CICD.md | grep -i "secret\|set-secrets"   # 應只剩歷史紀錄段落
grep -n "備援" docs/specs/06_部署架構與CICD.md                                       # cron 不再被稱為備援來源
grep -n "301" docs/specs/06_部署架構與CICD.md docs/specs/adr/ADR-0005-雲端平台-CloudRun.md docs/specs/01_需求規格書_SRS.md
sed -n 1,10p docs/specs/06_部署架構與CICD.md                                          # version 0.3
```

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| | | | | |
