---
id: T-0026
title: CR 修正（前端）：S-5 load 請求序列化防競態、S-6 編輯中草稿不被重繪吃掉
epic: E-001
team: dev
role: dev-fe
model: sonnet
status: done
round: 1
depends_on: [T-0020]
inputs:
  - docs/reports/20260919-1146-CR-E001.md#建議級（S-5、S-6）
  - public/assets/todo-store.js
  - public/assets/todo-view.js
  - tests/unit/todo-store.test.mjs
  - docs/specs/02_系統分析書_SA.md#5（BR-011 事實來源為後端）
outputs:
  - public/assets/todo-store.js
  - public/assets/todo-view.js
  - tests/unit/todo-store.test.mjs
acceptance:
  - S-5：store 有單調遞增 requestSeq，load 回應若非最新一次不寫入 state；單元測試模擬先發後到的回應，斷言畫面資料為最新篩選
  - S-6：編輯模式期間其他 store 通知不會清掉已輸入文字（editingDraft 或跳過該筆重繪）；有單元或以 DOM 模擬的測試
  - 不改 index.html、api-client.js、styles.css；11 個 data-testid 不變；innerHTML 仍為 0
  - npm run lint 與 node --test tests/unit/todo-store.test.mjs 全綠；git diff main...HEAD --stat 只動 outputs
reviewer: dev-tl
branch: task/T-0026-fix-frontend
created: 2026-09-19T12:03:12+08:00
updated: 2026-09-19T12:53:00+08:00
blocked_reason: null
---

## 目標

消除兩項會讓使用者看到不一致或遺失輸入的前端競態問題。

## 背景與限制

- 分支以 git worktree 建立（…-wt/T-0026，-b task/T-0026-fix-frontend）；禁止 add -A、--amend、reset、rebase。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/dev-fe.md 的通用協定。

## 驗收方式

dev-tl 重跑測試；在瀏覽器快速連續切換篩選與編輯中觸發其他更新，實測無不一致與草稿遺失。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | dev-tl | done | 四條全通過：lint 0、node --test tests/unit/todo-store.test.mjs 25/25、innerHTML 0、index.html／api-client.js／styles.css diff 0 筆、11 個 data-testid 不變；瀏覽器實測（compose 真實服務）快速切換篩選五連點後按鈕與清單一致，並以人為延遲 status=active 回應 1500ms 製造真正的先發後到，舊回應未覆蓋畫面（S-5）；編輯 TodoA 鍵入未儲存草稿後對 TodoB 觸發完成導致整段重繪，輸入框仍為 TodoA-DRAFT-UNSAVED，續按儲存正常寫入（S-6）。S-6 無自動化測試一項經 dev-tl 裁決接受（view 層依 07 測試計畫由 qa-at／qa-uat 以真實瀏覽器覆蓋，補 jsdom 需新增 devDependency 屬規格變更），已交 qa-at r2 補 E2E。已 --no-ff 合併 main | worklog/handoff/20260919-1246-T0026-r1-dev-tl.md |
