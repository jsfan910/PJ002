---
id: T-0025
title: CR 修正（DevOps）：S-3 secrets 經 env、S-7 監測保留狀態碼、S-10 compose 埠可配、S-11 dev 腳本與 engines、S-4 tests 型別檢查、S-9 三處參數同步表
epic: E-001
team: dev
role: dev-ops
model: sonnet
status: done
round: 1
depends_on: [T-0020]
inputs:
  - docs/reports/20260919-1146-CR-E001.md#建議級（S-3、S-4、S-7、S-9、S-10、S-11）
  - .github/workflows/deploy-staging.yml
  - .github/workflows/monitor-health.yml
  - docker-compose.yml
  - .env.example
  - package.json
  - tsconfig.json
  - README.md
  - docs/specs/06_部署架構與CICD.md
  - infra/cloudrun-service.yaml
  - scripts/deploy-staging.sh
outputs:
  - .github/workflows/deploy-staging.yml
  - .github/workflows/monitor-health.yml
  - docker-compose.yml
  - .env.example
  - package.json（僅 scripts.dev、scripts.lint、engines.node 三處；Leader 授權，dev-tl 合併時覆核）
  - tsconfig.test.json（新）
  - README.md（常用指令表 dev 但書、埠說明、engines）
  - docs/specs/06_部署架構與CICD.md（僅新增「三處必須同步的參數表」一節，屬實作紀錄）
acceptance:
  - S-3：deploy-staging.yml 的 run 內不再直接展開 secrets，全部經 env 宣告後以 "$VAR" 引用；actionlint 零 finding
  - S-7：monitor-health.yml 去掉 curl -f，真實狀態碼進 CSV；只有連不上才 000
  - S-10：compose db 埠為 "${POSTGRES_HOST_PORT:-5432}:5432"，.env.example 加說明
  - S-11：npm run dev 可用（tsc -w + node --watch dist/server.js 或等效），engines.node >= 22.18，README 常用指令表 dev 有但書
  - S-4：tsconfig.test.json 存在，npm run lint 同時檢查 tests/**；lint 全綠
  - S-9：06 新增三處參數對照表，內容與 cloudrun-service.yaml、deploy-staging.yml、scripts/deploy-staging.sh 現況一致
  - 全量 lint、build、test:unit、test:integration 仍全綠；git diff main...HEAD --stat 只動 outputs
reviewer: dev-tl
branch: task/T-0025-fix-ops
created: 2026-09-19T12:03:12+08:00
updated: 2026-09-19T12:45:00+08:00
blocked_reason: null
---

## 目標

消除 Code Review 六項 DevOps／工具鏈建議級，特別是 secrets 進命令列與監測狀態碼遺失兩項會影響 Gate 2 證據品質的問題。

## 背景與限制

- package.json 單一擁有者為 dev-tl；Leader 授權本卡改三處，dev-tl 合併時覆核。
- 06 已凍結設計部分；本卡只新增實作紀錄性質的參數對照表。
- 分支以 git worktree 建立（…-wt/T-0025，-b task/T-0025-fix-ops）；禁止 add -A、--amend、reset、rebase。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/dev-ops.md 的通用協定。

## 驗收方式

dev-tl 重跑 acceptance 每條；actionlint；npm run dev 實際啟動一次並 curl /health；npm run lint 含 tests。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | dev-tl | done | 七條全通過：actionlint 0 finding、deploy-staging.yml 的 run: 區塊 secrets. 零命中、monitor-health.yml 無 curl -f、compose 實測 POSTGRES_HOST_PORT=5437 生效、tsconfig.test.json 使 lint 涵蓋 8 個 tests/*.ts 且全綠、06 參數表逐格對帳與三處現況一致（含兩項飄移標註屬實）、unit 75/75、integration 47/47。package.json 三處（scripts.dev 拆 dev:build/dev:run、scripts.lint、engines.node>=22.18）經擁有者 dev-tl 覆核核准；`npm run dev` 已不存在，改以兩支 script 實測 /health 200（裁決理由見交接檔）。tests 兩檔型別註記為 S-4 必然伴隨變更，核准為範圍例外。已 --no-ff 合併 main | worklog/handoff/20260919-1236-T0025-r1-dev-tl.md |
