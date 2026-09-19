---
id: T-0035
title: 計畫書 v1.1 與 CLAUDE.md：Phase 定義、Gate 2 補驗流程、模型表（qa-uat sonnet）、規格優先原則、r2 升級裁量、鐵則整理
epic: E-002
team: leader
role: leader
model: opus
phase: framework
status: in_progress
round: 1
depends_on: []
inputs:
  - tasks/E-002-framework-v1.1.md（發現清單，本卡負責的 F 項）
  - tasks/E-001-todo-app.md（Leader 裁決紀錄全文，事實來源）
  - CLAUDE.md（協作協定、工作鐵則）
  - docs/團隊協作計畫書_20260919.md
outputs:
  - docs/團隊協作計畫書_20260919.md
  - CLAUDE.md
acceptance:
  - F-24：計畫書第 7 章加「Gate 2 補驗子流程」（staging 部署 → 回填 → 回滾演練 → 24h 採樣（平台 uptime check）→ 測試總結 r2 → Gate 2 報告 r2）；第 9 章 Phase 定義加「Phase 2 可與 Phase 1 尾段平行」
  - F-07：計畫書第 5.2 與 CLAUDE.md 模型表 qa-uat 改 Sonnet 5；加一行「Haiku 適用範圍：格式檢查與彙整，不適用需操作外部工具的角色」
  - F-06/F-14：CLAUDE.md 協作協定加「規格優先於 Leader 提示詞」與「r2 升級裁量」
  - F-02：計畫書第 3、7 章的分支敘述改為 worktree
  - F-25：CLAUDE.md 工作鐵則整理為「環境／git／流程／安全」四類，每條保留日期案例；新增本次尚未寫入的：PowerShell 管線吃換行、GitHub cron 不可靠、Haiku 不做 UAT、QA 平行存取 staging 要隔離
  - 計畫書 frontmatter 版本 v1.1，文末加變更紀錄；舊版不需封存（同檔進版）
  - 只改 outputs；每個變更在交接檔逐項對應到 F 編號；不改任何 tasks/T-00xx 卡與 docs/specs
  - 文字精簡：角色檔／模板／skill 每檔淨增不超過 60 行，重複內容移到共用段
reviewer: leader
branch: null
created: 2026-09-19T18:16:31+08:00
updated: 2026-09-19T18:16:31+08:00
blocked_reason: null
---

## 目標

讓計畫書與 CLAUDE.md 反映實際驗證過的流程，成為下一個 Epic 的起點。

## 背景與限制

- 這是框架卡：由 Leader 委派的 Opus agent 以 Leader 代理身分執行，直接在根目錄 main commit（文件卡），不建 worktree。
- 平行卡 T-0032～T-0035 各自 outputs 不重疊；只 git add 自己的檔；禁止 add -A、--amend、reset、rebase；commit 訊息寫檔 -F。
- 修改要「可驗證」：角色檔與 skill 改完，用一段假想派工提示詞（三行）走一遍，確認執行者只靠角色檔就知道環境限制、回報格式、禁止事項。
- 必須遵守：CLAUDE.md「協作協定」與 .claude/agents/leader.md。

## 驗收方式

Leader 逐 F 項核對落點存在且措辭與裁決紀錄一致；抽 2 個角色檔跑 dispatch 三行提示詞的可理解性。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
