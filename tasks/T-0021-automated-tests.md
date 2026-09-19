---
id: T-0021
title: 自動化測試：整合／E2E／效能腳本、README 15 分鐘實測、AT 報告
epic: E-001
team: qa
role: qa-at
model: sonnet
status: review
round: 1
depends_on: [T-0017, T-0018]
inputs:
  - docs/specs/07_測試計畫.md
  - docs/specs/20_測試案例.md（層級 integration／e2e／perf 且自動化＝是的全部 P0 案例）
  - docs/specs/04_API規格.yaml
  - docs/specs/06_部署架構與CICD.md#1（staging 網址）
  - docs/specs/traceability.md
  - README.md
  - tests/（既有單元與整合測試寫法）
  - docs/templates/qa_22_自動化測試報告.md
outputs:
  - tests/integration/qa/**
  - tests/e2e/**
  - tests/perf/**
  - .github/workflows/qa-tests.yml（新檔，不改 ci.yml；由 dev-tl 決定是否併入）
  - docs/reports/yyyymmdd-HHmm-AT-E001.md
acceptance:
  - 每個「自動化：是」的 P0 TC 有對應測試函式，函式名或描述含 TC-ID；缺者在報告列出原因
  - 本機（docker compose）與 staging（若網址與憑證就緒）各跑一次，報告分開列數字；staging 未就緒的 TC 記「阻擋（環境未就緒）」
  - E2E 用 Playwright（Chromium/Edge/Firefox 至少 Chromium），記錄實際瀏覽器版本號（TC-091）
  - 效能腳本涵蓋 NFR-001（P95 < 500ms／10 併發，先暖身 10 秒）；NFR-003 24 小時採樣由 T-0018 的 monitor workflow 提供數據，本卡只寫判讀方式
  - README 15 分鐘實測（TC-095）：在乾淨目錄依 README 方式一與方式二各做一次，記錄實際耗時與卡點；卡點即缺陷
  - 報告的通過／失敗數與原始輸出一致（原始輸出節錄貼報告末）；失敗案例對應缺陷 ID（由 qa-lead 於 T-0023 編號）
reviewer: qa-lead
branch: task/T-0021-automated-tests
created: 2026-09-19T09:24:01+08:00
updated: 2026-09-19T13:22:00+08:00
blocked_reason: null
---

## 目標

把測試案例變成可重複執行的程式並實際跑過，讓 Gate 2 的退出準則有數字可對。

## 背景與限制

- 測試程式碼走開發卡流程（worktree、分支、dev-tl 合併），但只寫 tests/ 與新 workflow，不動 src/ 與 package.json；需要新套件（Playwright、autocannon 等）先在交接檔提出，dev-tl 於合併時決定並安裝。
- 不得在倉庫寫入 staging 憑證；由環境變數讀取。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/qa-at.md 的通用協定。

## 驗收方式

qa-lead：重跑本機測試指令核對數字；核對 TC-ID 覆蓋（grep TC- 於 tests/ 對照 20 的自動化＝是清單）。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | dev-tl | 技術初審通過並合併 | 技術層面三項全過：分支未動 `src/`、未動 `package.json`、相依合理（僅 `@playwright/test`）。已 `--no-ff` 合併進 main（`beb3f0b`，無衝突）。收尾：`@playwright/test` 釘選 `1.63.0` 進 devDependencies 並更新 lock；補 `test:integration:qa`／`test:e2e`／`test:perf` 三個 script 並收斂 `test:integration` 的 glob（兩組測試前提不同，見 README「測試分層」）；新增 `tsconfig.e2e.json`（e2e 需 DOM 型別）並納入 `lint`；`qa-tests.yml` 改由 `npm ci` 取得 Playwright。合併後對含修正的 main 重跑：unit 76/76、integration 56/56、qa-integration 38 過／0 敗／4 阻擋（staging）、e2e Chromium 68/68（153.0.8010.12）、perf PASS、actionlint 0。**測試內容品質（TC 覆蓋、案例正確性）不在本次範圍，由 qa-lead 於 T-0023 審。** | worklog/handoff/20260919-1301-T0021-r1-dev-tl.md |
