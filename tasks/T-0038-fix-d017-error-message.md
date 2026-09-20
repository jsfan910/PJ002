---
id: T-0038
title: D-017 修正：前端錯誤訊息顯示時序競態（TC-067／TC-009 於 staging 間歇性失敗）
epic: E-001
team: dev
role: dev-fe
model: sonnet
phase: dev-fix
status: done
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
updated: 2026-09-20T19:33:36+08:00
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
| r1 | dev-tl | **初審通過，待合併**（依 Leader 本輪裁決不合併、不推送，卡維持 `status: review`） | acceptance 1／2／3／5 通過：根因引用行號屬實（`requestSeq` 只覆蓋 `load()`、142 行無條件 `error: null`、171／192 行同步驗證失敗不佔號），修正改為共用 `opSeq`／`beginOp()`／`isStale()`；我以隔離副本獨立複驗新測試「修正前紅、修正後綠」（非空測試）；lint EXIT=0、unit 78/78；diff 僅 outputs 2 檔＋任務卡＋交接檔，無硬編碼密鑰、未用 staging 憑證。**acceptance 4 判「條件通過」**：Docker daemon 本輪就緒，已於 8081／5433 起 compose 連跑 5 次（chromium／msedge × 1280x800／390x844，`-g "TC-067\|TC-009"`），5 次結果一致「6 過 2 敗」；2 敗固定為 msedge 兩尺寸的 **TC-009**，且失敗點是該 TC 最後一行「console 應無 error」被 `/favicon.ico` 404 觸發（21 筆 404 的 reqId 全對應 `/favicon.ico`），**D-017 的三條斷言（error-message 可見／非空／todo-item=0）5 次全過**；再以 `git worktree add --detach main` 獨立建置 main（修正前）跑同一測試 → **完全相同的 favicon 404 失敗**，證明與本卡無因果關係，故不退回。安全：`/health` 200，`/./health`／`/%2e/health`／`//health`／`/health/`／`/HEALTH`／`/api/v1/todos` 全 401，無豁免路徑繞過。合併風險：CI（`qa-tests.yml:126`）只跑 chromium，合併不會因 favicon 轉紅。**待辦**：①合併＋CHANGELOG＋worktree 清理（等 deploy-staging 綠燈）；②`/favicon.ico` 404 請 qa-lead 另立缺陷；③D-017 正式關閉仍須 staging 重跑 5 次（本機從未重現該缺陷） | worklog/handoff/20260920-1902-T0038-r1-dev-tl.md |
| r1（合併） | dev-tl | **done（已合併 main，merge commit `d8a7427`）** | r1 初審判「通過待合併」，acceptance 第 4 條當時為「條件通過」——唯一未過項是 msedge 兩尺寸 TC-009 敗於 `/favicon.ico` 404 觸發 console error，已由 T-0043 解除。本次刻意**先合併 T-0043（`1107bbd`）、再合併本卡（`d8a7427`）**，並在合併後的 main 上以 `git worktree add --detach` 拉獨立副本重建驗證，把 r1 的「條件」實際打掉：`npm ci`／`build`／`lint` EXIT=0、`test:unit` **78/78**（76 + 本卡新增 2 條）；compose `-p mchk`（PORT=8083／POSTGRES_HOST_PORT=5435），4 project（chromium／msedge × 1280x800／390x844）`-g "TC-067\|TC-009"` 連續 5 次 **8 passed × 5 = 40/40 全過**（r1 時同條件為每次 6 過 2 敗、5 次一致）；應用日誌 323×200／20×201／19×204／114×401，**零筆 404、零筆 5xx**。安全（SD 第 6 章）在合併狀態複驗：`/health` 200，`/./health`／`/%2e/health`／`/%2E/health`／`//health`／`/health/`／`/HEALTH`／`/api/v1/todos`／`/index.html`／`/styles.css` 全 401，`/favicon.ico` 無憑證 401、帶憑證 200，7 條 favicon 路徑變體全 401，零繞過。合併衝突僅任務卡 frontmatter `updated` 一欄，取 main 版 19:10:27。CHANGELOG 已補本卡與 T-0043 兩列。**D-017 仍未關閉**：該缺陷僅在 staging 重現（缺陷清單第 50 列），須待 staging 部署成功後由 qa-lead 於 staging 重跑 TC-067／TC-009 至少 5 次連續全過才判關閉；staging 部署目前卡在 T-0039 的 `roles/secretmanager.viewer` IAM 授權，**本次推送觸發的 deploy-staging run 預期仍在 `resolve secret versions` 停住，Leader 2026-09-20 已裁決此不計為本卡與 T-0043 的失敗，待 IAM 授權後重跑部署即上 staging**。worktree `<根>-wt/T-0038` 與分支 `task/T-0038-fix-d017` 已清理。 | worklog/handoff/20260920-1926-T0043-r1-dev-tl.md |
