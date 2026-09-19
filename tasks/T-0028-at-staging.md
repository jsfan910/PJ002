---
id: T-0028
title: 自動化測試 r3：對 staging 重跑三類測試、補 8 條阻擋 TC、NFR-003 24 小時採樣判讀
epic: E-001
team: qa
role: qa-at
model: sonnet
status: in_progress
round: 1
depends_on: [T-0027]
inputs:
  - docs/reports/20260919-1314-AT-E001-r2.md（本機基準）
  - docs/specs/20_測試案例.md（TC-078、079、080、081、084、089、090、105 與所有 integration/e2e/perf 案例）
  - docs/specs/07_測試計畫.md#4
  - docs/specs/06_部署架構與CICD.md（staging 網址、監測 workflow、回滾）
  - .github/workflows/monitor-health.yml（採樣 artifact／CSV 位置）
  - README.md「測試分層」
outputs:
  - docs/reports/yyyymmdd-HHmm-AT-E001-r3.md
  - tests/**（僅在需要以 BASE_URL 參數化或修正環境差異時小修，記錄於交接檔）
acceptance:
  - 以 BASE_URL=https://todo-app-dpevsdhdva-de.a.run.app 重跑 test:integration:qa、test:e2e（Chromium+Edge）、test:perf，各層級數字與本機 r2 對照列表
  - 8 條原阻擋 TC 逐條有結果（通過／失敗／仍阻擋附原因）；TC-080/084/090 需部署事件者以 T-0027 的回滾演練紀錄或一次 workflow_dispatch 觸發取得數據
  - NFR-003：讀取 monitor-health 採樣 CSV，計算已採樣時數與成功率；未滿 24 小時則報「採樣中（已 N 小時，目前成功率 X%）」並附下次判讀時間
  - staging 憑證由環境變數 STAGING_BASIC_AUTH_USER/PASSWORD 讀取（使用者提供於 shell 或由 Leader 轉交），不入報告不入版控
  - 報告的每個數字有原始輸出節錄；與本機差異逐項說明
reviewer: qa-lead
branch: task/T-0028-at-staging
created: 2026-09-19T16:31:34+08:00
updated: 2026-09-19T16:39:33+08:00
blocked_reason: null
---

## 目標

用真實 staging 補齊 Gate 2 擋關項的證據：P0 TC 全數執行、NFR-003 採樣判讀。

## 背景與限制

- staging：https://todo-app-dpevsdhdva-de.a.run.app（Basic Auth 帳密由使用者提供；Leader 於派工時以環境變數形式轉交，不寫入任何檔案）。
- 24 小時採樣由 monitor-health.yml 每 5 分鐘一次累積，本卡在採樣未滿時先出「採樣中」版本，Leader 於 24 小時後再開 r2 判讀（或由本卡交接檔載明判讀指令供 qa-lead 執行）。
- 分支以 git worktree 建立（…-wt/T-0028）；禁止 add -A、--amend、reset、rebase。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/qa-at.md 的通用協定。

## 驗收方式

qa-lead：核對 r3 報告數字與原始輸出一致；抽查 2 條原阻擋 TC 的證據；重算 NFR-003 成功率。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
