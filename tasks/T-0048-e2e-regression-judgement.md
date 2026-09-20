---
id: T-0048
title: 測試總結 r5：完整 e2e 回歸（含 Firefox）判定、TC-091 定案、TC-037 疑慮釐清、第 1 項最終數字
epic: E-001
team: qa
role: qa-lead
model: opus
phase: qa-staging
status: review
round: 1
depends_on: [T-0046]
inputs:
  - docs/reports/20260920-2210-完整e2e回歸-使用者實測.md（204 條：201 過、3 敗；失敗細節；Leader 初判）
  - docs/reports/20260920-2215-e2e失敗三條重跑-使用者實測.md（3 輪：18/18、18/18、17/18，TC-037 於 chromium-390x844 敗 1；Leader 初判測試前置競態）
  - docs/reports/20260920-2145-測試總結-E001-r4.md（r4 全表，本輪沿用）
  - docs/reports/20260920-1901-AT-E001-r4-firefox.md（TC-091 前次判定 4／6 與環境限制說明）
  - worklog/handoff/20260920-1902-T0038-r1-dev-tl.md 與 CHANGELOG.md 的 T-0038 條目（「動作被較新動作取代時回 stale 且不重新載入清單」的已接受行為改變，dev-tl 建議 qa-lead 評估補 TC）
  - public/assets/todo-store.js（現行 opSeq／isStale 實作）、tests/e2e/us004-delete.e2e.test.ts（TC-037 前置步驟如何建立資料）
  - docs/specs/24_缺陷清單.md、docs/specs/traceability.md、docs/specs/07_測試計畫.md#5
outputs:
  - docs/reports/20260920-HHmm-測試總結-E001-r5.md
  - docs/specs/24_缺陷清單.md（若 TC-037 判為產品缺陷則立案；若判 flaky／環境則以觀察項記錄）
  - docs/specs/traceability.md（僅主表「狀態」欄：TC-091、必要時 TC-037／TC-011／TC-016 所在列）
acceptance:
  - 三條失敗逐條判定：TC-016（fetch failed）、TC-011（page.goto ERR_TIMED_OUT）依重跑結果判「環境暫時性網路」或「產品」；TC-037 須讀 todo-store.js 與測試前置步驟，說明失敗是否可由 T-0038 的 stale 行為解釋（建立動作被 load 取代 → 清單未刷新），並以重跑結果佐證；不可只寫「flaky」
  - TC-091（NFR-004 六組相容性）：Firefox 兩組於使用者機器實跑 68 條 67 過 1 敗（網路）；依重跑結果判 6／6 或維持 4／6 並寫明理由；退出準則第 10 項更新
  - 退出準則第 1 項最終數字：依判定重算（105／105 或列出仍未通過者）；其餘項標「沿用 r4」
  - 若 TC-037 判為產品缺陷：立 D-019（嚴重度依 07 §5、附重現步驟）並建議修正方向與是否擋 P1；若判 flaky：寫明重跑通過次數與觀察項，並建議是否為 T-0038 的 stale 行為補一條 TC（dev-tl 於 T-0038 審核時的建議）
  - 建議與裁決事項五段式；traceability 更新後孤兒檢查六項仍「無」（貼 diff 輸出）
  - 不索取憑證；只引用使用者實測紀錄並註明來源
reviewer: leader
branch: null
created: 2026-09-20T22:12:00+08:00
updated: 2026-09-20T22:28:54+08:00
blocked_reason: null
---

## 目標

用使用者的完整回歸與重跑結果，把退出準則第 1 項與第 10 項收斂到最終數字，並釐清 TC-037 是否暴露了 T-0038 行為改變的副作用。

## 背景與限制

- 上游：T-0046 r4；使用者完整 e2e（201／204）與三條重跑；T-0038 已接受的 stale 行為改變。
- 下游：Leader Gate 2 r2 附錄；P1 開卡（若 D-019 成立，P1 第一批含修正）。
- 必須遵守：CLAUDE.md 協作協定；角色檔 `.claude/agents/qa-lead.md`；文件卡在 main 作業；不索取憑證。

## 驗收方式

Leader：核對三條判定各有證據引用；`grep -n "TC-091" docs/specs/traceability.md`；第 1 項數字與 §1.1 加總；若立 D-019 則 `grep -n "D-019" docs/specs/24_缺陷清單.md`。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| | | | | |
