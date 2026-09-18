---
id: T-0009
title: 測試計畫、測試案例、追溯矩陣 TC 欄
epic: E-001
team: qa
role: qa-lead
model: opus
status: in_progress
round: 1
depends_on: [T-0007]
inputs:
  - docs/specs/01_需求規格書_SRS.md
  - docs/specs/02_系統分析書_SA.md#5
  - docs/specs/03_系統設計書_SD.md#6
  - docs/specs/04_API規格.yaml
  - docs/specs/06_部署架構與CICD.md
  - docs/specs/traceability.md
  - docs/templates/qa_07_測試計畫.md
  - docs/templates/qa_20_測試案例.md
outputs:
  - docs/specs/07_測試計畫.md
  - docs/specs/20_測試案例.md
  - docs/specs/traceability.md（僅 TC 欄與孤兒檢查第 5 項）
acceptance:
  - 測試計畫：範圍、層級與負責、進入準則、退出準則（Gate 2 門檻，含 NFR-003 的 24 小時採樣）、缺陷分級齊全
  - 測試案例：每個 P0 US 至少 2 個案例（正常 + 例外）；每條 P0 AC 至少 1 個 TC；每個 NFR 至少 1 個可量測案例；每案例有 ID、層級、對應 US/AC、前置、步驟、預期結果、優先級、自動化與否
  - 特殊驗證 AC（traceability 該表）的 TC 以該表判準為準
  - traceability.md 主表 TC 欄全部填實；孤兒檢查第 5 項「無對應 TC 的 US」為「無」，並新增第 6 項「無對應 US 的 TC」為「無」
  - P1 案例另列並標「Gate 2 後」
reviewer: leader
branch: null
created: 2026-09-19T07:18:48+08:00
updated: 2026-09-19T07:18:48+08:00
blocked_reason: null
---

## 目標

在開發進行的同時準備好測試計畫與案例，使開發完成後 qa-cr／qa-at／qa-uat 可立即開工；並補齊追溯矩陣最後一欄。

## 背景與限制

- 規格已凍結（Gate 1 通過 2026-09-19）。發現規格有誤不改規格，寫進交接檔「需要 Leader 裁決的事」。
- 只改本卡 outputs；traceability.md 只動 TC 欄與孤兒檢查段，其他欄不動。dev-tl 正平行寫 10_開發計畫_WBS.md，不要碰。
- staging 尚未存在；測試計畫的環境章節寫「依 06 部署設計」即可。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/qa-lead.md 的通用協定。

## 驗收方式

Leader：grep -c "^| TC-" docs/specs/20_測試案例.md；grep traceability 主表 TC 欄無「—」；抽查 US-001、US-006 的 TC 對應 AC。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
