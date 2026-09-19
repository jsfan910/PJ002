---
id: T-0029
title: UAT r3：於 staging 逐 P0 使用者故事操作
epic: E-001
team: qa
role: qa-uat
model: haiku
status: blocked
round: 1
depends_on: [T-0027]
blocked_reason: |
  前端應用無法通過瀏覽器連接到 staging API。根本原因為認證方案不相容：
  頁面從帶認證信息的 URL 載入時（https://user:pass@host），Chromium 安全模型
  禁止 JavaScript 發送包含認證的 fetch 請求。需前端修正認證方案（如 Authorization
  標頭、session cookie 或 OAuth/JWT）後重新執行 r4 UAT。
  
  已驗證：API 層功能正常（curl 測試通過 US-009, US-010）；問題屬環境配置而非
  代碼缺陷。
inputs:
  - docs/reports/20260919-1301-UAT-E001-r2.md（本機基準與操作方式）
  - docs/specs/01_需求規格書_SRS.md（US-001～US-010）
  - docs/specs/20_測試案例.md（層級 uat）
  - docs/templates/qa_23_UAT報告.md
outputs:
  - docs/reports/yyyymmdd-HHmm-UAT-E001-r3.md
  - docs/reports/uat-screenshots/r3/
acceptance:
  - 在 staging（https://todo-app-dpevsdhdva-de.a.run.app）逐 US-001～US-010 操作，每步「做了什麼 → 看到什麼」；操作方式沿用 r2（先以帶帳密網址載入建立認證快取，再以裸網址操作）
  - US-010（staging 部署）以實際網址驗證：/health 200、未帶憑證 401、帶憑證可用
  - 冷啟動體驗記錄：閒置 15 分鐘後首次載入耗時（供 NFR-001 離群值參考）
  - 報告不含憑證
reviewer: qa-lead
branch: null
created: 2026-09-19T16:31:34+08:00
updated: 2026-09-19T16:58:00+08:00
blocked_reason: null
---

## 目標

以終端使用者視角在真實 staging 確認 P0 十則可用。

## 背景與限制

- Basic Auth 帳密由使用者提供，Leader 派工時以環境變數轉交；報告與交接檔不得出現。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/qa-uat.md 的通用協定。

## 驗收方式

qa-lead：抽查 2 個 US 的操作紀錄可重現；核對 P0 十則皆有結果。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
