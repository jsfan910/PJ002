---
id: T-0020
title: P0 全量 Code Review（阻擋級為 0 才通過）
epic: E-001
team: qa
role: qa-cr
model: opus
status: review
round: 2
depends_on: [T-0017, T-0018]
inputs:
  - docs/specs/03_系統設計書_SD.md#6
  - docs/specs/04_API規格.yaml
  - docs/specs/05_資料庫設計.md
  - docs/specs/adr/
  - docs/specs/02_系統分析書_SA.md#5
  - docs/templates/code_review_report.md
  - worklog/handoff/（T-0011～T-0018 各卡開發者與 dev-tl 交接檔的「假設與決策」「下一步建議」）
  - src/**、public/**、tests/**、migrations/**、Dockerfile、.github/workflows/**、infra/**
outputs:
  - docs/reports/20260919-1146-CR-E001.md
  - docs/reports/20260919-1309-CR-E001-r2.md（r2 複審報告）
acceptance:
  - 報告依模板：每個發現有檔案:行號、嚴重度（阻擋／建議）、說明、修正建議
  - 檢查清單每項打勾或說明不適用（API 規格符合、DB 設計符合、錯誤處理、安全、測試品質、無硬編碼密鑰、遵守 ADR）
  - 實際跑一次 lint、單元、整合測試並貼輸出，確認各卡交接檔的宣稱屬實
  - 憑證掃描用 dev-tl 補強樣式（含可選引號），對全倉庫執行並貼輸出
  - 對 T-0011～T-0018 開發者「假設與決策」逐條表態接受／不接受（附理由）
  - 結論明確：阻擋級 = N；N=0 通過，否則退回並列出每一阻擋項對應的修正卡建議（Leader 建卡）
reviewer: qa-lead
branch: null
created: 2026-09-19T09:24:01+08:00
updated: 2026-09-19T13:16:00+08:00
blocked_reason: null
---

## 目標

對合併到 main 的 P0 全部程式碼做一次靜態審查，找出測試找不到的問題：邏輯漏洞、安全缺口、與設計書偏離、會在三個月後咬人的結構。

## 背景與限制

- 審查對象是 main 上 T-0011～T-0018 合併後的最終狀態，不是各分支。
- 不修改任何程式碼；發現即記錄。修正由 Leader 依報告建 dev 修正卡。
- 審查重點順序：正確性 → 安全 → 規格符合 → 測試品質 → 可維護性（建議級）。
- 特別檢查：/health 豁免比對（pathname、點節段）、Basic Auth 常數時間、redact、UUID 不洩漏、trim 早於長度檢查、204 無本文、篩選在後端、SQL 全參數化、Dockerfile 非 root 與 $PORT、workflow 無長期金鑰、migration forward-only。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/qa-cr.md 的通用協定。

## 驗收方式

qa-lead：核對報告檢查清單無空項；抽查 3 個阻擋級或建議級發現是否確實存在於指定行號；重跑報告所列的測試指令。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | leader | rework→r2 | CR 退回阻擋 2／建議 11 已由 T-0024～T-0026 修正合併（main 4b96b20）；r2 只複審修正處與 startup-migrate 回歸 | worklog/handoff/20260919-工作交接.md |
