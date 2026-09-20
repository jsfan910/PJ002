---
id: T-0038
title: D-017 修正：前端錯誤訊息顯示時序競態（TC-067／TC-009 於 staging 間歇性失敗）
epic: E-001
team: dev
role: dev-fe
model: sonnet
phase: dev-fix
status: todo
round: 1
depends_on: []
inputs:
  - docs/specs/24_缺陷清單.md#D-017（現象、重現步驟、失敗訊息、建議方向）
  - docs/specs/20_測試案例.md#TC-067、#TC-009（預期結果）
  - docs/specs/01_需求規格書_SRS.md#BR-029、#BR-030（後端失敗時顯示可讀錯誤）
  - docs/specs/03_系統設計書_SD.md（前端 store／view 單向資料流章節）
  - public/assets/todo-store.js、public/assets/todo-view.js、public/assets/api-client.js（現行實作）
  - tests/e2e/（TC-067／TC-009 測試檔與 playwright.config.ts 的 project 名稱）
  - docs/reports/20260919-1719-AT-E001-r3.md（staging 失敗紀錄與重跑結果）
outputs:
  - public/assets/todo-store.js
  - public/assets/todo-view.js
  - tests/unit/todo-store.test.mjs（新增重現競態的單元測試）
acceptance:
  - 交接檔「假設與決策」寫明根因：錯誤狀態在哪兩個事件之間被清掉／覆蓋（引用程式行號），以及修正後的狀態轉移規則；不得只寫「加了延遲」
  - 新增單元測試重現「請求失敗 → 錯誤訊息設定 → 在下一次 render 前被清除」的時序，修正前失敗、修正後通過（交接檔貼兩次輸出）
  - `npm run lint`、`npm run test:unit` 全綠（貼輸出）
  - 本機 docker compose（PORT=8081、POSTGRES_HOST_PORT=5433，避免與其他卡撞埠）以 `npm run test:e2e -- --project=<chromium 與 msedge 的兩種尺寸> -g "TC-067|TC-009"` 連續執行 5 次全數通過（貼 5 次摘要）；不得修改 tests/e2e 的斷言或逾時
  - 不改動 outputs 以外的檔案；未使用任何 staging 憑證（staging 重跑留 P1 staging 測試輪）
reviewer: dev-tl
branch: task/T-0038-fix-d017
created: 2026-09-20T18:35:00+08:00
updated: 2026-09-20T18:35:00+08:00
blocked_reason: null
---

## 目標

修掉 D-017：真實網路延遲下，前端錯誤訊息（`error-message`）偶爾維持 `hidden`，使 TC-067／TC-009 在 staging 約 2～4 成失敗。這是 Gate 2 有條件通過後清待辦的第一張卡（使用者裁決③ A）。

## 背景與限制

- 上游：qa-lead 於 T-0030 立案 D-017（S3／open），Leader 2026-09-19T17:30:10 裁決②修正列 P1；使用者 2026-09-20 Gate 2 r2 裁決③ A「先清待辦再開 P1」。
- 下游：dev-tl 初審合併 → 推送觸發 staging 部署；qa-lead 於下一輪測試總結關閉 D-017；T-0042（Release Notes 定版）依賴本卡。
- 必須遵守：CLAUDE.md 協作協定與工作鐵則；角色檔 `.claude/agents/dev-fe.md`；SD 前端單向資料流（store 為唯一狀態來源，view 只依 state 繪製）；**一律在 git worktree `<根目錄>-wt/T-0038` 內作業**，根目錄停在 main。
- 本機從未重現（僅 staging 重現），因此驗證以「單元測試重現時序」為主、e2e 連跑 5 次為輔；Docker 不可用時依角色檔的離線替代驗證並註明。
- 只准 append 的 git：不 amend／reset／rebase；只 add 自己的 outputs。

## 驗收方式

dev-tl 在 worktree 分支上：

```bash
npm ci && npm run lint && npm run test:unit
# 單元測試須含 D-017 對應案例（名稱含 D-017 或 TC-067）
grep -rn "D-017\|TC-067\|TC-009" tests/unit/todo-store.test.mjs
# e2e 連跑（PORT=8081 POSTGRES_HOST_PORT=5433 起 compose 後）
for i in 1 2 3 4 5; do BASE_URL=http://localhost:8081 npm run test:e2e -- -g "TC-067|TC-009"; done
git diff --stat main...task/T-0038-fix-d017   # 只含 outputs 三檔
```

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| | | | | |
