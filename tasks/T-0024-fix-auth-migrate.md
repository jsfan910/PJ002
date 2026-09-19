---
id: T-0024
title: CR 修正（後端）：B-1 豁免比對不正規化、B-2 啟動時自動 migration、S-1 關閉型別脅迫、S-2 豁免限 GET/HEAD
epic: E-001
team: dev
role: dev-be
model: sonnet
status: done
round: 1
depends_on: [T-0020]
inputs:
  - docs/reports/20260919-1146-CR-E001.md#阻擋級（B-1、B-2）
  - docs/reports/20260919-1146-CR-E001.md#建議級（S-1、S-2）
  - docs/specs/03_系統設計書_SD.md#6
  - docs/specs/05_資料庫設計.md#3
  - docs/specs/04_API規格.yaml
  - src/plugins/basic-auth.ts
  - src/server.ts
  - src/db/migrate.ts
  - src/routes/todos.ts
  - tests/integration/auth-basic.test.ts
outputs:
  - src/plugins/basic-auth.ts
  - src/server.ts
  - src/app.ts（僅 ajv customOptions coerceTypes false 一處，或於 routes 設 validatorCompiler，二擇一）
  - tests/integration/auth-basic.test.ts
  - tests/integration/startup-migrate.test.ts（新）
  - tests/integration/todos-api.test.ts（僅補型別脅迫案例）
  - Dockerfile（Leader 追加授權：runtime 階段補 COPY migrations ./migrations 一行，修 B-2 容器內 ENOENT）
acceptance:
  - B-1：豁免比對只剝除 ? 與 # 之後，不做任何正規化；/foo/../health、/.%2e/health、/%2e%2e/health、/assets/%2e%2e/%2e%2e/health 未帶憑證皆 401（測試斷言）；/health 與 /health?x=1 仍 200
  - S-2：豁免只適用 GET 與 HEAD；POST /health 未帶憑證回 401
  - B-2：src/server.ts 在 listen 前呼叫 runMigrations，失敗以非 0 結束並印出原因；新增回歸測試：對未套用 migration 的資料庫啟動後 GET /api/v1/todos 不得 500（可用臨時資料庫或 DROP 後重跑）
  - S-1：POST 送 {"title":123} 回 400、{"isCompleted":null} 回 400（測試斷言）；既有 122 項測試仍全綠
  - git diff main...HEAD --stat 只動 outputs；不改 package.json、config.ts、repository
reviewer: dev-tl
branch: task/T-0024-fix-auth-migrate
created: 2026-09-19T12:03:12+08:00
updated: 2026-09-19T12:36:00+08:00
blocked_reason: null
---

## 目標

消除 Code Review 兩項阻擋級與兩項相關建議級，讓 P0 認證邊界只靠自己的比對而非第三方穿越防護，且照 README 裝起來的服務可用。

## 背景與限制

- Leader 裁決：先前 T-0013-③「不做啟動時自動 migrate」與凍結規格（05 §3 第 4 條、SD NFR-008 對策④）衝突，規格優先，撤回該裁決；deploy pipeline 的 migrate 階段保留（雙重保險）。
- 修正建議以 CR 報告 B-1／B-2／S-1／S-2 的「修正建議」欄為準。
- 分支以 git worktree 建立（git worktree add "C:/Users/excal/Projects/Claude/soft-dev-team-260919-wt/T-0024" -b task/T-0024-fix-auth-migrate），所有操作在 worktree 內；禁止 add -A、--amend、reset、rebase。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/dev-be.md 的通用協定。

## 驗收方式

dev-tl 在 worktree 重跑 acceptance 每條；curl --path-as-is 實測四個變體 401；乾淨資料庫（docker compose down -v 後 up）啟動服務直接 GET /api/v1/todos 回 200 空陣列。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | dev-tl | done | acceptance 五條全通過：豁免比對純字串切割無正規化（原始碼確認）、四個點節段變體與 POST /health 實測 401、/health 與 /health?x=1 200；docker compose down -v 後 up --build 乾淨環境容器啟動即自動建表、GET /api/v1/todos 200 []，migration 失敗路徑 exit(1) 且不監聽；coerceTypes 關閉後 title 送數字／PATCH isCompleted null 皆 400；lint 0、build 0、unit 75/75、integration 56/56；diff 只動 outputs（Dockerfile 一行為 Leader 追加授權）。已 --no-ff 合併 main | worklog/handoff/20260919-1227-T0024-r1-dev-tl.md |
