---
id: T-0027
title: staging 首次部署、網址回填、回滾演練、24 小時監測啟動
epic: E-001
team: dev
role: dev-ops
model: sonnet
status: blocked
round: 1
depends_on: [T-0018, T-0025]
inputs:
  - README.md#部署與 secrets（T-0018）
  - docs/specs/06_部署架構與CICD.md
  - .github/workflows/deploy-staging.yml
  - .github/workflows/monitor-health.yml
  - scripts/deploy-staging.sh
  - scripts/rollback-staging.sh
  - docs/specs/04_API規格.yaml#servers
  - worklog/handoff/20260919-1133-T0018-r1-dev-tl.md
outputs:
  - docs/specs/06_部署架構與CICD.md（僅第 1 章 staging 網址、第 5.4 節回滾演練紀錄、第 6 章實作紀錄）
  - docs/specs/04_API規格.yaml（僅 servers 的 staging url 回填，Leader 裁決 T-0018-①）
  - README.md（僅補「GCP 指令在哪裡執行」一段：Cloud Shell 或本機 SDK；Windows cmd／PowerShell 下 gcloud.cmd、佔位符替換、<(echo) 改寫檔、secret 用檔案避免換行）
  - docs/reports/yyyymmdd-HHmm-部署紀錄-E001.md
acceptance:
  - GitHub Actions deploy-staging 在 main 上綠燈（附 run 網址與各階段狀態）；若紅燈，找出原因並提出修正（workflow／設定問題可改 workflow；GCP 設定問題列出使用者要做的事，不索取憑證）
  - staging 網址可存取：/health 無憑證 200；/ 無憑證 401；/api/v1/todos 帶憑證 200（憑證由環境變數或使用者提供，不入報告）
  - 三處回填：GitHub variable STAGING_BASE_URL（列出使用者要在網頁設定的值，或以 gh/API 無法時請使用者設定）、06 第 1 章、04 servers
  - 回滾演練：依 06 §5.1 用 scripts/rollback-staging.sh 或 gcloud run services update-traffic 切回前一 revision 並切回來，記錄耗時與驗證輸出於 06 §5.4（需 gcloud 認證；本機若無 gcloud 登入則以 workflow_dispatch 或列出使用者要執行的指令）
  - monitor-health.yml 已啟動並至少產生 1 次成功採樣（附 run 網址）；24 小時採樣由後續 qa 卡判讀
  - 部署紀錄報告：時間軸、每階段輸出節錄、遇到的問題與解法、使用者後續要做的事
reviewer: dev-tl
branch: task/T-0027-staging-deploy
created: 2026-09-19T15:50:02+08:00
updated: 2026-09-19T16:20:00+08:00
blocked_reason: >-
  ［r1 續，2026-09-19 16:20］使用者已修正 WIF attribute-condition，deploy-staging.yml
  第三次真實 run（35431202802）auth／migrate／build&push／deploy／verify(URL)／
  verify(/health) 全部成功，staging 首次部署成功：
  https://todo-app-dpevsdhdva-de.a.run.app（revision todo-app-00001-tfq）。唯一失敗步驟
  是 verify（帶憑證呼叫 /api/v1/todos），exit code 22。已用 Secret Manager 唯讀位元組
  計數診斷（未讀取任何憑證明文）確認根因：basic-auth-user 的 latest 版本含 3 個混入的
  換行／回車字元（raw=12 bytes, stripped=9 bytes），與 GitHub secret
  STAGING_BASIC_AUTH_USER 不一致，導致 Basic Auth 判定「使用者名稱或密碼錯誤」
  （已用刻意錯誤憑證測試驗證錯誤訊息型態為「Invalid username or password」而非
  「Missing or bad formatted authorization header」，排除程式/部署缺陷）。修法屬憑證值
  變更，agent 不代為執行：使用者需以 README「GCP 指令在哪裡執行」節的
  [System.IO.File]::WriteAllText 寫法重建乾淨版本並確認與 GitHub secret 相同，
  再重新觸發 deploy-staging.yml（新增 secret 版本不會讓現有 revision 自動生效）。
  已回填 06 第 1 章與 04 servers 為真實網址；GitHub variable STAGING_BASE_URL 待使用者
  設定為上述網址。回滾演練待該次重新部署產生第 2 個 revision 後執行。詳見
  docs/reports/20260919-1551-部署紀錄-E001.md「r1 續」章節與
  worklog/handoff/20260919-1551-T0027-r1-dev-ops.md。
---

## 目標

把 T-0018 準備好的 pipeline 在真實 GCP 上跑通，取得 staging 網址，讓測試團隊可以補跑 staging 相關 TC 與 24 小時採樣。

## 背景與限制

- 使用者已完成 GCP（專案 pj002-509106、區域 asia-east1、WIF pool github-pool／provider github-provider、服務帳號 github-deployer、Secret Manager 三個 secret、Artifact Registry todo-app）與 GitHub（repo jsfan910/PJ002，5 variables、5 secrets）一次性設定。
- Leader 已加 remote origin 並推送 main（首次推送需使用者在 GCM 視窗登入）。推送本身會觸發 deploy-staging.yml。
- 本機無 gh CLI；Actions 狀態用瀏覽器工具看 https://github.com/jsfan910/PJ002/actions（公開倉庫可讀）。本機 gcloud 需先 gcloud.cmd auth login（使用者已登入過本機 SDK；若 agent 執行時未登入，不得代登入，改列出指令請使用者執行）。
- 憑證由使用者自行設定，agent 不索取、不代填、不寫入任何檔案。
- 分支以 git worktree 建立（…-wt/T-0027，-b task/T-0027-staging-deploy）；禁止 add -A、--amend、reset、rebase。workflow 若需修正，在分支改、dev-tl 合併後再推送觸發。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/dev-ops.md 的通用協定。

## 驗收方式

dev-tl：開 Actions run 網址確認綠燈；curl staging 三條；核對三處回填；讀 06 §5.4 演練紀錄。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
