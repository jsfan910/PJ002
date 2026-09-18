---
id: T-0006
title: SRS 小修：S-1 第 6 章狀態同步、S-2 NFR-003 數值矛盾、S-3 AC-009-5 備註
epic: E-001
team: plan
role: plan-ba
model: opus
status: review
round: 1
depends_on: [T-0005]
inputs:
  - docs/reports/20260919-0637-覆蓋度審核-E001.md#5.2
  - docs/specs/01_需求規格書_SRS.md
  - tasks/E-001-todo-app.md#Leader 裁決紀錄
outputs:
  - docs/specs/01_需求規格書_SRS.md
acceptance:
  - S-1：第 6 章 Q-001～Q-011 十一列狀態欄改「已裁決（Leader）」，確認來源欄改 tasks/E-001-todo-app.md#Leader 裁決紀錄
  - S-2：NFR-003 需求欄「允許失敗 ≤ 100 次／2016 次」改「≤ 20 次／2016 次」；量測方式欄不動
  - S-3：AC-009-5 原文不動，其後加一行備註指向 docs/specs/traceability.md「特殊驗證方式的 AC」表
  - git diff 只有上述三處變更 + frontmatter（version 0.2→0.3、updated）
reviewer: leader
branch: null
created: 2026-09-19T06:52:15+08:00
updated: 2026-09-19T06:54:15+08:00
blocked_reason: null
---

## 目標

依覆蓋度審核報告 5.2 節三項條件修正 SRS，使其可於 Gate 1 凍結。

## 背景與限制

- 來源：docs/reports/20260919-0637-覆蓋度審核-E001.md 第 6 章「有條件通過」的條件項。Gate 1 凍結規格前必須完成。
- 純文字修正，不改任何設計決策；不新增內容；frontmatter version 進版、updated 更新。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/plan-ba.md 的通用協定。

## 驗收方式

Leader 執行 git diff HEAD~1 -- docs/specs/01_需求規格書_SRS.md，確認變更行數與三項一致；grep -c 已裁決 得 11。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
