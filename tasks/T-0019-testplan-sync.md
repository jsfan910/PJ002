---
id: T-0019
title: 測試計畫與案例同步 Cloud Run；追溯矩陣 NFR 對應與狀態欄補填；NFR-004 改寫
epic: E-001
team: qa
role: qa-lead
model: opus
status: in_progress
round: 1
depends_on: [T-0010]
inputs:
  - tasks/E-001-todo-app.md#Leader 裁決紀錄（對 T-0009 7 項的裁決）
  - worklog/handoff/20260919-0719-T0009-r1-qa-lead.md#B
  - docs/specs/06_部署架構與CICD.md（T-0010 後的 Cloud Run 版）
  - docs/specs/adr/ADR-0005-雲端平台-CloudRun.md
  - docs/specs/07_測試計畫.md
  - docs/specs/20_測試案例.md
  - docs/specs/traceability.md
outputs:
  - docs/specs/07_測試計畫.md
  - docs/specs/20_測試案例.md
  - docs/specs/traceability.md（NFR 追溯表「對應測試」欄、主表「狀態」欄）
acceptance:
  - 07 第 6.1 節環境表與第 7 章 R-4 改為 Cloud Run（冷啟 1–3 秒、revision 回滾）；grep -c Render 07 為 0
  - TC-079、TC-084、TC-089 改寫為 Cloud Run 對應判準；grep -c Render 20 為 0（歷史備註除外須註明）
  - traceability NFR 追溯表八格填實；主表狀態欄改「UC／模組／端點／TC 全欄已定稿（T-0019）」；其他欄不動
  - NFR-004 依裁決 3 改寫 TC-091 備註與 07 R-5 為「最新版即可」
  - TC 總數仍 123、連號、TC 集合與 traceability 一致（重跑 T-0009 的 V1～V3 指令）
reviewer: leader
branch: null
created: 2026-09-19T07:40:06+08:00
updated: 2026-09-19T07:43:43+08:00
blocked_reason: null
---

## 目標

把 T-0009 依 Render 撰寫的五處同步到 Cloud Run，並完成 Leader 授權的追溯矩陣補欄與 NFR-004 改寫。

## 背景與限制

- 規格已凍結；本卡只改 outputs 三檔的指定段落，不動 SRS、SD、06、ADR。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/qa-lead.md 的通用協定。

## 驗收方式

Leader：grep -c Render 07 與 20；重跑 T-0009 交接檔 V1～V3 指令。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
