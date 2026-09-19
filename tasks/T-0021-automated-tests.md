---
id: T-0021
title: 自動化測試：整合／E2E／效能腳本、README 15 分鐘實測、AT 報告
epic: E-001
team: qa
role: qa-at
model: sonnet
status: done
round: 2
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
updated: 2026-09-19T13:58:00+08:00
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
| r1 | leader | rework→r2 | dev-tl 技術初審通過並合併（beb3f0b，e7abe4f）；r2 對最終 main 重跑三類並更新 AT 報告 | worklog/handoff/20260919-工作交接.md |
| r2 | qa-lead | **done** | **通過（測試內容品質）。** 依 Leader 2026-09-19T13:12:54 裁決**跑足兩條 integration 指令**，六項數字**與 AT r2 報告完全一致**：`npm run build` EXIT=0；`npm run lint`（4 個 tsc project）EXIT=0；`npm run test:unit` **76 pass／0 fail／0 skip**；`npm run test:integration`（進程內 `app.inject`，`DATABASE_URL` 指向自用 5436）**56 pass／0 fail／0 skip**；`docker compose -p qal23` 起服務後 `npm run test:integration:qa`（真實 HTTP，`BASE_URL=http://localhost:8093`）**42 條：38 pass／0 fail／4 skip**，4 個 skip 全為 TC-079／080／084 與 TC-087 的 500 子案例，skip 訊息逐條寫明阻擋理由；`npm run test:e2e --project=chromium-1280x800 --project=chromium-390x844` **68 passed (25.1s)**。**TC-ID 抽查五條全部存在且斷言對題**：TC-011（`tests/e2e/us001-create.e2e.test.ts:63` 輸入框清空可續新）、TC-029（`us003-edit.e2e.test.ts:61` 編輯已刪除項顯示可讀錯誤）、TC-047（`us005-toggle.e2e.test.ts:45` 切換後重整狀態保持）、TC-088（`nfr-xss.e2e.test.ts:18` `<script>alert(1)</script>` 原樣顯示為文字、零彈窗）、TC-094（`tests/perf/tc094-nfr007-capacity.perf.mjs`）。**兩項不影響結論的更正已記入缺陷清單觀察**：OBS-4 報告「覆蓋 84 條」的計數有誤，所列區間展開為 80 條、扣掉明文不寫腳本的 TC-089 後**實際 79 條**，與 `grep -roE "TC-[0-9]{3}" tests/` 去重結果逐一相符（覆蓋內容正確）；OBS-3 `tests/unit/**` 與 `tests/integration/*.test.ts` 未標 TC-ID，11 條 unit 層 P0 TC 無法逐條追溯（建議 P1 補標註）。另**補齊 AT r2 遺漏的 TC-094 子項**：500 筆下「前端可互動 < 3 秒」未量測，本卡於瀏覽器實測 502 筆於導覽開始後 **166 ms** 全數渲染完成 → PASS。 | worklog/handoff/20260919-1329-T0023-r1-qa-lead.md |
