---
id: T-0028
title: 自動化測試 r3：對 staging 重跑三類測試、補 8 條阻擋 TC、NFR-003 24 小時採樣判讀
epic: E-001
team: qa
role: qa-at
model: sonnet
status: done
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
updated: 2026-09-19T17:38:24+08:00
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
| r1 | dev-tl | 技術初審通過並合併 | diff 僅動 docs/reports、tests/e2e/playwright.config.ts（環境差異小修）、任務卡、交接檔，未動 src/ 與 package.json；憑證掃描無字面值命中；合併後根目錄 build／test:unit（76/76）／test:integration（56/56）全綠，lint 唯一錯誤在 `scripts/gen-schedule.mjs`（來自 main 既有 commit b2fb97b，非本卡）。內容品質由 qa-lead 於 T-0030 續審，status 維持 review。 | worklog/handoff/20260919-1733-T0028-r1-dev-tl.md |
| r1 | qa-lead | **done（內容品質通過）** | **抽查 TC-084**：`06` §5.4 演練紀錄含 revision 名稱（`todo-app-00002-sn7` ↔ `todo-app-00003-lt2`）、耗時 9.689s／10.355s、切換後流量 100% 與 `/health` 連續 3 次 200；`scripts/rollback-staging.sh` 存在且可執行（2553 bytes）。**抽查 TC-090**：以 GitHub API 獨立核對 —— 報告聲稱的兩次真實部署 run `35432964533`（08:47:46~08:49:12Z）、`35432984799`（08:48:14~08:49:45Z）**確實存在且皆 `success`**，完整落在 228 樣本的輪詢窗（08:40~08:59Z）內，「0 秒不可用」判定成立。**重算數字全部一致**：integration:qa 36+1+5=42 ✅、e2e 136−3=133 ✅、NFR-001 四段 P95（156.4／315.6／158.5／316.9 ms）皆低於門檻 ✅、NFR-007 116.2 ms ✅。**獨立複驗 TC-079**：qa-lead 自行 `curl -sSI http://todo-app-dpevsdhdva-de.a.run.app/health` 得 `HTTP/1.1 302 Found` ＋ `location: https://.../health`，與報告逐字相符。**重算 NFR-003**：GitHub API `total_count = 1`（唯一 run `35432903869`、`workflow_dispatch`、`attempt 2`、`success`、`created_at 08:46:26Z`）→ run 級成功率 1/1 = 100%、已採樣 0.87 小時；**報告的「採樣中」結論成立**，另發現 `cron "*/5 * * * *"` 至今 0 次自動觸發（已列測試總結 r2 裁決事項 B）。**兩處小瑕疵，不影響結論、已於測試總結 r2 更正**：①報告把 `35432984799` 的 08:48:14Z 標為「完成」，實為 `created_at`（完成為 08:49:45Z）；②TC-080 僅間接證據，本卡判「**部分通過**」而非通過。**另核**：於 main `cd2025e` 重跑 `npm run lint` 得 `LINT_EXIT=0`，dev-tl 初審提到的 `scripts/gen-schedule.mjs` 錯誤在合併後的 main 上**已不重現**。報告的誠實揭露（操作疏失兩則、TC-080 限制、憑證未入檔）符合角色要求。 | worklog/handoff/20260919-1731-T0030-r1-qa-lead.md |
