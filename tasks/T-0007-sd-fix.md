---
id: T-0007
title: SD/API 小修：D-1 OpenAPI 補標 UC-014、D-2 SD-02 文字對齊
epic: E-001
team: plan
role: plan-sd
model: opus
status: in_progress
round: 1
depends_on: [T-0005]
inputs:
  - docs/reports/20260919-0637-覆蓋度審核-E001.md#4
  - docs/specs/04_API規格.yaml
  - docs/specs/03_系統設計書_SD.md#9
outputs:
  - docs/specs/04_API規格.yaml
  - docs/specs/03_系統設計書_SD.md
acceptance:
  - D-1：getTodoById／updateTodo／deleteTodo 三個 operation 的 description 各補一句「（P1）UC-014：以使用者身分隔離存取，跨使用者回 404」；grep -c UC-014 得 3
  - D-2：SD 第 9 章 SD-02 的「第一行」改為「同一個 migration 內、ALTER ... SET NOT NULL 之前」
  - OpenAPI lint 仍為 0 errors（npx @redocly/cli lint；不可用時以等效檢查註明）
  - git diff 只有上述變更 + frontmatter（version 進版、updated）
reviewer: leader
branch: null
created: 2026-09-19T06:52:15+08:00
updated: 2026-09-19T06:52:15+08:00
blocked_reason: null
---

## 目標

依覆蓋度審核報告第 4 章兩項條件修正 OpenAPI 與 SD，使設計包可於 Gate 1 凍結。

## 背景與限制

- 來源：docs/reports/20260919-0637-覆蓋度審核-E001.md 第 6 章「有條件通過」的條件項。Gate 1 凍結規格前必須完成。
- 純文字修正，不改任何設計決策；不新增內容；frontmatter version 進版、updated 更新。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/plan-sd.md 的通用協定。

## 驗收方式

Leader 執行 grep -c UC-014 docs/specs/04_API規格.yaml 得 3；git diff 確認 SD 僅 SD-02 一列變更。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
