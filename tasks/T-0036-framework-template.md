---
id: T-0036
title: 匯出乾淨框架範本（framework-template/ + scripts/export-framework.sh）
epic: E-002
team: leader
role: leader
model: opus
phase: framework
status: in_progress
round: 1
depends_on: [T-0032, T-0033, T-0034, T-0035]
inputs:
  - CLAUDE.md
  - docs/團隊協作計畫書_20260919.md
  - .claude/agents/、.claude/skills/
  - docs/templates/
  - scripts/extract-cards.sh、scripts/gen-schedule.mjs、docs/schedule/E-001.json
  - .gitignore
outputs:
  - scripts/export-framework.sh
  - framework-template/（由腳本產生的快照，入版控）
  - framework-template/README-框架.md
  - framework-template/docs/團隊協作計畫書.md（去專案化版本）
acceptance:
  - scripts/export-framework.sh <目標目錄> 可重跑：清空目標後從本 repo 複製 CLAUDE.md（去 E-001 專屬字句：文件地圖中的計畫書檔名改為 docs/團隊協作計畫書.md、staging 等專案資訊移除；協定、回報規則、收工規則、工作鐵則保留）、.claude/agents、.claude/skills、docs/templates、scripts/extract-cards.sh、scripts/gen-schedule.mjs、.gitignore；建立空的 tasks/_todo.md、tasks/_done.md（只留表頭與說明）、docs/archive/_index.md（只留表頭）、docs/schedule/example.json（空 Epic 範例）、空目錄 docs/specs/adr、docs/reports、worklog/handoff、worklog/daily_summary、ref、src、tests（含 .gitkeep）
  - 計畫書去專案化：移除第 10 章裁決結果、E-001 數據與 Gate 報告引用，保留架構、文件清單、模型表、流程、7.6 補驗子流程、風險、變更紀錄；檔名 docs/團隊協作計畫書.md
  - README-框架.md：新專案起手式（複製 → 改名 → git init → 確認 Node／Docker／gcloud → 開新 Claude Code session 讓角色定義載入 → 對 Leader 說需求 → Phase 0 已完成直接 Phase 1）；含目錄說明與「不包含什麼」
  - 範本內 grep 不得出現：E-001、pj002、jsfan910、todo-app、run.app、Neon、Render（計畫書歷史案例段除外，須明列例外行）
  - 用範本在暫存目錄實際起一個新專案：git init、複製、確認 CLAUDE.md 與 12 個角色檔、5 個 skill、25 個模板存在；node scripts/gen-schedule.mjs docs/schedule/example.json 對空 cards.txt 可產生不報錯
reviewer: leader
branch: null
created: 2026-09-19T18:30:00+08:00
updated: 2026-09-19T18:30:00+08:00
blocked_reason: null
---

## 目標

讓這整套規則可以一鍵套用到任何新專案資料夾，且之後框架更新能重新匯出。

## 背景與限制

- 框架卡：Leader 代理直接在根目錄 main 作業；只 add outputs；禁止 add -A、--amend、reset、rebase；commit 訊息寫檔 -F。
- 快照目錄 framework-template/ 入版控，供直接複製或另建 GitHub template repo；腳本是事實來源，快照由腳本產生。
- 本 repo 的 .gitignore 不得忽略 framework-template/。
- 必須遵守：CLAUDE.md「協作協定」與 .claude/agents/leader.md。

## 驗收方式

Leader 在暫存目錄跑一次 export 並檢查 grep 清單與檔案數。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
