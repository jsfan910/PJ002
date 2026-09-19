---
id: T-0018
title: staging 部署（Cloud Run）、健康監測、回滾演練
epic: E-001
team: dev
role: dev-ops
model: sonnet
status: todo
round: 1
depends_on: [T-0010, T-0011, T-0015, T-0016]
inputs:
  - docs/specs/10_開發計畫_WBS.md#1.8（WI-08 全文：背景與限制、驗收方式草案）
  - docs/specs/10_開發計畫_WBS.md#0（硬前提，尤其第 5、6、7、8 條）
  - docs/specs/10_開發計畫_WBS.md#5（共用檔案規約，觸碰 src/app.ts、package.json、README.md 者必讀）
  - docs/specs/03_系統設計書_SD.md
  - docs/specs/04_API規格.yaml
  - docs/specs/05_資料庫設計.md
  - docs/specs/06_部署架構與CICD.md
  - docs/specs/adr/
  - tasks/E-001-todo-app.md#Leader 裁決紀錄
outputs:
  - infra/cloudrun-service.yaml
  - .github/workflows/deploy-staging.yml
  - .github/workflows/monitor-health.yml
  - docs/specs/06_部署架構與CICD.md（僅第 1 章網址、第 5 章演練紀錄、第 6 章實作紀錄三處）
  - README.md（部署與 secrets 章節；並依 Leader 裁決 T-0011-dev-tl-① 在「方式二：本機 Node」補 .env 載入步驟）
acceptance:
  - WBS §1.8「驗收方式草案」的每條指令實際執行且結果符合，指令與真實輸出貼交接檔
  - npm run lint 與相關測試全綠；不改本卡 outputs 以外的檔案（git diff --stat 佐證）
  - workflow 通過 actionlint 或等效語法檢查；認證用 Workload Identity Federation，倉庫無任何金鑰
  - 離線可驗證到最後一步：本機 docker build、cloudrun-service.yaml 語法檢查；實際部署需使用者提供 GCP 專案與 GitHub repo，缺則在交接檔明列「被憑證阻擋的最後一步」與使用者要做的事
  - 回滾程序（revision 切流量）寫成可執行指令；有 GCP 時實際演練一次並記錄
  - README 方式二逐字照做可在乾淨 shell 啟動並 curl /health 回 200（Git Bash 與 PowerShell 各實測一次）
reviewer: dev-tl
branch: task/T-0018-deploy-monitor
created: 2026-09-19T07:39:05+08:00
updated: 2026-09-19T07:39:05+08:00
blocked_reason: null
---

## 目標

實作 WBS WI-08「staging 部署（Cloud Run）、健康監測、回滾演練」。本卡的背景、限制與驗收指令以 `docs/specs/10_開發計畫_WBS.md` §1.8 為準（該節為本卡正文的一部分，必須整段讀完再開工）。

## 背景與限制

- 規格已凍結（Gate 1 通過 2026-09-19；T-0010 規格變更後以最新 06 與 ADR-0005 為準）。發現規格有誤不改規格，寫進交接檔「需要 Leader 裁決的事」；可用保守假設就繼續並記錄。
- WBS §0 硬前提第 5 條：倉庫不得出現任何憑證值（Leader 裁決 D-01：`.env.example` 可含僅限本機 compose 的明顯佔位值如 `dev`，staging 值只在平台 secrets）。
- WBS §0 硬前提第 6 條：所有指令可在 Windows 11 Git Bash 或 PowerShell 執行。
- WBS §0 硬前提第 7 條：只用官方外掛並釘選版本；package.json 由 T-0011 單一擁有，後續卡需要新套件先向 dev-tl 提出。
- WBS §0 硬前提第 8 條與 §5：src/app.ts 五個錨點順序固定，每卡只在自己的錨點插入一行。
- 分支：以 git worktree 建立（`git worktree add "C:/Users/excal/Projects/Claude/soft-dev-team-260919-wt/{id}" -b task/{id}-{slug}`），所有操作在該 worktree 內；分支名 `task/T-0018-deploy-monitor`；只在分支 commit；合併由 dev-tl 執行。禁止 add -A、--amend、reset、rebase。
- 模型：sonnet（Leader 依平衡模式指定）。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/dev-ops.md 的通用協定。

## 驗收方式

審核者（dev-tl）在該卡的 worktree（或自建 worktree）checkout 分支 `task/T-0018-deploy-monitor`，實際重跑 WBS §1.8 的驗收指令與本卡 acceptance 逐條核對；以 `git diff main...HEAD --stat` 確認只動 outputs。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
