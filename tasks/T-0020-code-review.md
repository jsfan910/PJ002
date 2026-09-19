---
id: T-0020
title: P0 全量 Code Review（阻擋級為 0 才通過）
epic: E-001
team: qa
role: qa-cr
model: opus
status: done
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
updated: 2026-09-19T13:58:00+08:00
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
| r2 | qa-lead | **done** | **通過。** 抽查 r2 報告指名的三處行號**全部存在且內容如述**：`src/plugins/basic-auth.ts:53-64` `stripQueryAndHash()` 為純字串切割（只找 `?`／`#` 取較小索引後 `slice`）、`:70-75` `isExemptPath()` 以 `=== HEALTH_PATHNAME`（`:29` = `"/health"`）完全相等比對且限 `GET`／`HEAD`；`src/server.ts:35-56` `applyMigrationsOrExit()` 在 `app.listen` 之前呼叫、失敗 `app.log.error` 後 `process.exit(1)`；`Dockerfile:43` `COPY migrations ./migrations`；`src/app.ts:39-43` `ajv.customOptions.coerceTypes: false`。**重跑 r2 的五段（超過要求的三條）**：§1 build／lint 皆 `EXIT=0`；§2 乾淨資料卷（`docker compose -p qal23 down -v` → `up --build`，自用埠 8093／5436）**未執行任何 migrate 指令**即 `GET /api/v1/todos` → `200 []`，`\dt` 有 `todos`＋`schema_migrations`，`schema_migrations` 有 `001`；§3 八種 request-target 中四個 r1 繞過變體（`/foo/../health`、`/.%2e/health`、`/%2e%2e/health`、`/assets/%2e%2e/%2e%2e/health`）**全部 401**、`/health` 與 `/health?x=1` 仍 200、七種方法中僅 `GET`／`HEAD` 為 200 其餘皆 401；§6 unit 76／76；§7 `POST {"title":123}` → 400、`PATCH {"isCompleted":null\|"true"}` → 400、`PATCH {"isCompleted":true}` → 200。**阻擋級 = 0 核實成立**，13／13 已修正屬實。兩處措辭不精確已記入缺陷清單觀察（OBS-5：報告稱「全檔已無 `new URL(`」，實查仍有 2 處但**皆在註解**，可執行碼確已無，結論不受影響）。N-1 已登錄為 D-014（S3、open，Leader 已裁列 P1）。 | worklog/handoff/20260919-1329-T0023-r1-qa-lead.md |
