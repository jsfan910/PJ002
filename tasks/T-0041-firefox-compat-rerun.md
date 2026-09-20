---
id: T-0041
title: NFR-004 Firefox 兩組相容性補跑（非沙盒環境）
epic: E-001
team: qa
role: qa-at
model: sonnet
phase: qa
status: blocked
round: 1
depends_on: []
inputs:
  - docs/specs/07_測試計畫.md（NFR-004 相容性矩陣與判定）
  - docs/specs/20_測試案例.md#TC-091
  - docs/reports/20260919-1719-AT-E001-r3.md（E-B-09：`browserType.launch: spawn UNKNOWN`、已跑 4 組的結果）
  - tests/e2e/playwright.config.ts（Firefox 兩個 project 名稱）
  - README.md（測試章節：`npx playwright install`、`test:e2e` 用法）
  - tasks/E-001-todo-app.md（Leader 2026-09-19T12:32:40 裁決：Firefox 於 Gate 2 後非沙盒環境補跑）
outputs:
  - docs/reports/20260920-HHmm-AT-E001-r4-firefox.md
  - docs/specs/traceability.md（僅主表 TC-091 所在列的「狀態」欄）
acceptance:
  - `npx playwright install firefox` 實際執行並貼輸出；若本環境仍無法啟動 Firefox，卡改 blocked，交接檔貼完整錯誤與已嘗試的替代（例如 `PLAYWRIGHT_BROWSERS_PATH`、系統 Firefox `channel`），並在報告寫出讓使用者在自己機器上執行的單一指令
  - 對本機 docker compose（PORT=8082、POSTGRES_HOST_PORT=5434；不使用任何 staging 憑證）執行 Firefox 兩個 project 的完整 e2e，報告貼 Playwright 摘要（通過／失敗／跳過條數、失敗案例名稱與訊息）
  - TC-091 判定：兩組全過 → 6／6，traceability 主表該列狀態更新；有失敗 → 逐條列出並判斷是產品缺陷還是工具限制（附證據），不自行立案缺陷（交 qa-lead）
  - 報告註明：本輪為本機環境，staging Firefox 重跑留 P1 staging 測試輪；不與其他卡並行使用相同埠
  - 不改 tests/e2e 內容；不動 outputs 以外的檔案
reviewer: qa-lead
branch: null
created: 2026-09-20T18:35:00+08:00
updated: 2026-09-20T19:01:08+08:00
blocked_reason: 本機 docker compose（PORT=8082/POSTGRES_HOST_PORT=5434）下 Firefox 兩個 project 仍 68/68 於 browser.launch 階段失敗（spawn UNKNOWN），與沙盒環境的 E-B-09 同一錯誤；已 --force 重新下載二進位檔、對照 Chromium 4/4 正常、Node 直接 spawn 重現定位為 Windows CreateProcess 層級失敗、確認本機無系統版 Firefox 可替代，判定為工具/執行環境限制而非產品缺陷。需使用者在自己機器（非本工具沙盒）執行報告內提供的單一指令補跑。
---

## 目標

補齊 NFR-004 六組相容性中缺的 Firefox 兩組（1280×800、390×844），把退出準則第 10 項從 4／6 推到 6／6，或給出明確的「產品缺陷／工具限制」判定。

## 背景與限制

- 上游：AT r3 E-B-09（沙盒無法啟動 Firefox）；Leader 2026-09-19T12:32:40 裁決 Gate 2 後補跑；使用者 2026-09-20 Gate 2 r2 裁決③ A。
- 下游：qa-lead 下一輪測試總結（第 10 項）；T-0042 Release Notes 已知限制欄。
- 必須遵守：CLAUDE.md 協作協定與工作鐵則（多 QA agent 不得同時對同一環境操作；只動自己建立的資料）；角色檔 `.claude/agents/qa-at.md`。本卡只跑本機，不接 staging。
- 本卡不改程式，直接在專案根目錄（main）執行；compose 埠用 8082／5434 與 T-0038 的 8081／5433 錯開。

## 驗收方式

qa-lead：

```bash
grep -n "firefox" tests/e2e/playwright.config.ts        # 取 project 名稱
# 報告內須有 Playwright 摘要行（例：「N passed (…)」）與 install 輸出
grep -n "TC-091" docs/specs/traceability.md
```

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| | | | | |
