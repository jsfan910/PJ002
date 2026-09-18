---
id: T-0010
title: 規格變更請求：雲端平台改 GCP Cloud Run（保留 Neon Free）
epic: E-001
team: plan
role: plan-sd
model: opus
status: done
round: 1
depends_on: [T-0007]
inputs:
  - tasks/E-001-todo-app.md#Leader 裁決紀錄
  - docs/specs/adr/ADR-0003-雲端平台.md
  - docs/specs/adr/ADR-0004-認證與同源部署.md
  - docs/specs/06_部署架構與CICD.md
  - docs/specs/03_系統設計書_SD.md#1
  - docs/specs/03_系統設計書_SD.md#2
  - docs/specs/03_系統設計書_SD.md#7
  - docs/templates/spec_ADR.md
outputs:
  - docs/specs/adr/ADR-0003-雲端平台.md（僅 status 改 superseded(by ADR-0005) 與一行說明）
  - docs/specs/adr/ADR-0005-雲端平台-CloudRun.md
  - docs/specs/06_部署架構與CICD.md
  - docs/specs/03_系統設計書_SD.md（僅第 1.2 節容器圖、第 2 章技術選型表雲端列、第 7 章與冷啟相關的 NFR 對策列、第 9 章 SD-04）
acceptance:
  - ADR-0005：背景（使用者裁決與理由）、選項至少 3 個（Cloud Run+Neon、Cloud Run+Cloud SQL、維持 Render）各有代價、決定、後果（含「計費帳戶必須啟用」「min instances=0 才免費」）
  - 06 第 2 章雲端資源清單：Cloud Run service、Artifact Registry repo、（可選）Cloud Scheduler 或 GitHub Actions 定時喚醒；每項有規格與費用估計
  - 06 第 3 章 pipeline：deploy-staging 改為 docker build → push Artifact Registry → gcloud run deploy；認證採 Workload Identity Federation（附 GitHub secrets/variables 名稱），並保留服務帳號金鑰作備選
  - 06 第 4 章環境變數：移除 Render 專屬項，新增 GCP 專屬項（GCP_PROJECT_ID、GCP_REGION、WIF provider、SA email、Artifact Registry 路徑等）只列名稱與用途
  - 06 第 5 章回滾：首選改為 Cloud Run revision 切流量（gcloud run services update-traffic），目標時間與驗證步驟明確；備選 git revert 流程保留
  - 06 第 6 章監控：改為 Cloud Run 內建指標 + GitHub Actions 定時健康檢查；冷啟說明改為 1–3 秒
  - SD：第 2 章雲端列指向 ADR-0005；第 1.2 節容器圖改 Cloud Run；SD-04 冷啟風險描述同步；frontmatter version 進版並在文末加「變更紀錄」一行
  - 所有變更不影響 API 規格、DB 設計、SRS、SA；交接檔明列「未動的檔案」
  - 06 與 SD 的 frontmatter status 維持 frozen，但 version 進版並註明「T-0010 規格變更」
reviewer: leader
branch: null
created: 2026-09-19T07:29:49+08:00
updated: 2026-09-19T07:43:43+08:00
blocked_reason: null
---

## 目標

依使用者裁決把部署平台從 Render Free 換成 GCP Cloud Run，資料庫維持 Neon Free；讓 dev-ops 骨架卡可以直接依新設計開工。

## 背景與限制

- 這是 Gate 1 後的正式「規格變更請求」，由使用者裁決、Leader 核准，故可修改已凍結文件；每份被改的文件 version 進版並在文末加變更紀錄。
- 不改：ADR-0001、ADR-0002、ADR-0004（同源與 Basic Auth 邏輯不變，若有引用 Render 的字句只做名詞替換並在交接檔列出）、SRS、SA、API、DB、traceability。
- Dockerfile 設計不變（同一個映像跑在 Cloud Run）。/health 豁免、Basic Auth 應用層 hook 不變。
- Cloud Run 必須設計成 min instances = 0（免費），並保留定時喚醒（GitHub Actions cron 每 10 分鐘打 /health）以降低冷啟。
- 平行作業：dev-tl（T-0008，寫 10_開發計畫_WBS.md）與 qa-lead（T-0009，寫 07、20、traceability TC 欄）正在進行，不要碰那些檔。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/plan-sd.md 的通用協定。

## 驗收方式

Leader：grep -c Render docs/specs/06_部署架構與CICD.md 應為 0（歷史說明除外，須註明）；grep "Cloud Run" 06 與 SD 各 ≥ 1；ADR-0003 status 為 superseded；ADR-0005 存在且 accepted。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | leader | done | 9/9 通過；ADR-0005 accepted、ADR-0003 superseded、06 v0.2、SD v0.3。裁決：授權補修 SD 三處與 API servers 佔位符（同卡追加 commit）；保溫每 5 分鐘；不建 render.yaml | worklog/handoff/20260919-工作交接.md |
