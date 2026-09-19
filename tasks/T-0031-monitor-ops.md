---
id: T-0031
title: 維運：NFR-003 採樣來源補強（Cloud Monitoring uptime check）、GitHub cron 診斷、TC-080 直接量測
epic: E-001
team: dev
role: dev-ops
model: sonnet
status: review
round: 1
depends_on: [T-0027]
inputs:
  - docs/specs/06_部署架構與CICD.md#6
  - .github/workflows/monitor-health.yml
  - docs/reports/20260919-1738-測試總結-E001-r2.md#6（裁決 B、C）
  - tasks/E-001-todo-app.md#Leader 裁決紀錄（最後一段）
  - docs/specs/20_測試案例.md（TC-080、TC-089、TC-090）
outputs:
  - infra/uptime-check.md 或 infra/uptime-check.sh（建立 uptime check 的 gcloud 指令與參數，可重跑）
  - docs/specs/06_部署架構與CICD.md（僅第 6 章：採樣來源、判讀指令、cron 診斷結論）
  - .github/workflows/monitor-health.yml（僅在診斷出可修的設定問題時改）
  - docs/reports/yyyymmdd-HHmm-監測補強-E001.md
acceptance:
  - GitHub cron 診斷：列出可能原因與證據（預設分支、workflow 檔位置、repo 活動、GitHub 排程延遲），並記錄診斷當下 schedule 事件的 run 數
  - Cloud Monitoring uptime check 建立：目標 https://todo-app-dpevsdhdva-de.a.run.app/health、週期 5 分鐘、逾時 10 秒、至少 3 個檢查位置、期望 200；用 gcloud monitoring uptime create 或 API；記錄 check id 與建立時間（UTC 與 +08:00）
  - 判讀指令：提供從 Cloud Monitoring 取得 24 小時內成功率的 gcloud／API 指令並實跑一次貼輸出（即使樣本仍少）
  - 06 第 6 章更新：NFR-003 主要來源改為 uptime check，GitHub cron 為備援；採樣起算時間以 uptime check 建立時間為準並寫明
  - TC-080：本卡推送 main 觸發的部署期間，以每 1 秒輪詢 /health 記錄不可用秒數，貼輸出
  - 不在任何檔案寫入憑證；GCP 操作用本機已登入的 gcloud（完整路徑 "C:/Users/excal/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"），若權限不足列出使用者要做的事
reviewer: dev-tl
branch: task/T-0031-monitor-ops
created: 2026-09-19T17:47:01+08:00
updated: 2026-09-19T18:09:10+08:00
blocked_reason: null
---

## 目標

讓 NFR-003 的 24 小時採樣有一條不依賴 GitHub 排程的可靠來源，並釐清 cron 未觸發的原因。

## 背景與限制

- monitor-health.yml 自 2026-09-19 16:46 手動觸發成功後，59 分鐘內 cron 零次自動執行（API total_count=1）。
- Cloud Monitoring uptime check 在免費額度內；建立屬 GCP 資源變更，Leader 已依使用者授權（部署 staging）核准；只建 1 個 check，不建告警政策（可在報告建議）。
- 分支以 git worktree 建立（…-wt/T-0031）；禁止 add -A、--amend、reset、rebase。dev-tl 合併後推送 main（會觸發部署，正好用來做 TC-080）。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/dev-ops.md 的通用協定。

## 驗收方式

dev-tl：gcloud monitoring uptime list 看到 check；重跑判讀指令；核對 06 第 6 章；看 TC-080 輪詢輸出。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
