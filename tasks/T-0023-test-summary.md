---
id: T-0023
title: 缺陷清單、CR/AT/UAT 彙整、測試總結報告（Gate 2 建議）
epic: E-001
team: qa
role: qa-lead
model: opus
status: done
round: 1
depends_on: [T-0020, T-0021, T-0022]
inputs:
  - docs/specs/07_測試計畫.md#4（退出準則）
  - docs/reports/（CR-E001、AT-E001、UAT-E001 三份報告）
  - docs/specs/20_測試案例.md
  - docs/specs/traceability.md
  - docs/templates/qa_24_缺陷清單.md
  - docs/templates/qa_25_測試總結報告.md
outputs:
  - docs/specs/24_缺陷清單.md
  - docs/reports/20260919-1356-測試總結-E001.md
  - docs/specs/traceability.md（僅主表「狀態」欄更新為測試結果）
acceptance:
  - 缺陷清單：每個缺陷有 ID、嚴重度 S1–S4、重現步驟、預期／實際、對應 TC、來源（CR/AT/UAT）、狀態；S1/S2 標明需 Leader 建修正卡
  - 測試總結：退出準則表每格有實際數字（P0 TC 通過率、P1 略、阻擋級 CR 數、開放 S1/S2 數、UAT P0 結果、NFR-003 24h 採樣結果或「採樣中」、README 實測耗時）
  - 建議明確：可發布／不可發布 + 殘留風險
  - 對 T-0020／T-0021／T-0022 三卡做為 reviewer 的審核紀錄已寫入各卡
reviewer: leader
branch: null
created: 2026-09-19T09:24:01+08:00
updated: 2026-09-19T14:06:43+08:00
blocked_reason: null
---

## 目標

決定「這個版本能不能過」，並給 Leader 出 Gate 2 報告所需的全部數字。

## 背景與限制

- 以三份報告中的實際數據為準，不採信「大致通過」。
- 退回開發時每個缺陷附重現步驟與對應 TC，否則不算缺陷。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/qa-lead.md 的通用協定。

## 驗收方式

Leader：核對退出準則表無空格；抽查 2 個缺陷可重現。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | leader | done | 退出準則 12 項每格有數字；缺陷 15 筆登錄完整；裁決 A 採建議、B 維持、C 追認列 P1 | worklog/handoff/20260919-工作交接.md |
