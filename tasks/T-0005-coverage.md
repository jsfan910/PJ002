---
id: T-0005
title: 反向審核 SD 覆蓋度、追溯矩陣定稿
epic: E-001
team: plan
role: plan-ba
model: opus
status: done
round: 1
depends_on: [T-0004]
inputs:
  - docs/specs/01_需求規格書_SRS.md
  - docs/specs/03_系統設計書_SD.md
  - docs/specs/04_API規格.yaml
  - docs/specs/traceability.md
outputs:
  - docs/specs/01_需求規格書_SRS.md（僅 NFR-003 量測期改寫）
  - docs/specs/01a_需求澄清紀錄.md（狀態欄同步）
  - docs/specs/traceability.md
  - docs/reports/20260919-0637-覆蓋度審核-E001.md
acceptance:
  - 逐 US 對照 SD 模組表與 API 端點：每個 P0/P1 US 都有對應，否則列出缺口
  - traceability.md 孤兒檢查「無對應 UC 的 US」「無對應模組/API 的 US」皆為「無」（TC 欄留給 qa-lead）
  - 覆蓋度審核報告列出：檢查了幾個 US、缺口清單（無則寫無）、對 SRS 或 SD 的修正建議
  - docs/specs/01a_需求澄清紀錄.md 所有 Q 項狀態更新為「已裁決（Leader）」並引用 tasks/E-001-todo-app.md 裁決紀錄
  - SRS NFR-003 量測方式改寫為「Gate 2：24 小時（每 5 分鐘一次，成功率 ≥ 99%）；正式環境：連續 7 天」，其餘 NFR 不動；SRS frontmatter version 進版
  - 審核 traceability.md 的 AC 對照表與「特殊驗證 AC」表與 SD 一致（見 worklog/handoff/20260919-0628-T0004-r1-plan-sa.md 下一步建議）
reviewer: leader
branch: null
created: 2026-09-19T05:28:50+08:00
updated: 2026-09-19T06:52:15+08:00
blocked_reason: null
---

## 目標

以需求方視角確認設計沒有漏掉任何使用者故事，並定稿追溯矩陣（TC 欄除外）。發現缺口時不自行改 SD，寫進報告交 Leader 建修正卡。

## 背景與限制

- Epic：tasks/E-001-todo-app.md（範圍、限制、成功指標以該檔為準）
- 本卡為 Phase 1 試跑；文件卡直接 commit 到 main。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/plan-ba.md 的通用協定。
- Leader 裁決：tasks/E-001-todo-app.md「Leader 裁決紀錄」全部。SD-03（409）與 SD-05（/api/v1）Leader 已接受，不列缺口。
- 審核者交辦：worklog/handoff/20260919-0628-T0004-r1-plan-sa.md「下一步建議」中標給 T-0005 的項目；標給 plan-sd 的（UC-014 OpenAPI 標註、SD-02 文字對齊）不在本卡，列入報告「對 SD 的修正建議」即可。
- 檔名不加日期（docs/specs 例外規則），版本寫 frontmatter。

## 驗收方式

Leader 讀覆蓋度審核報告與 traceability.md；抽查 2 個 P0 US 從 SRS 追到 API 端點。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | leader | done | 6/6 通過；覆蓋缺口 0、孤兒檢查四項無。S-1/S-2/S-3 交 T-0006，D-1/D-2 交 T-0007，均為 Gate 1 前置條件 | worklog/handoff/20260919-工作交接.md（Leader 審核紀錄於每日交接） |
