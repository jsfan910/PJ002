---
id: T-0034
title: skill v1.1：dispatch 三行提示詞與備援、review-round worktree 清理與 r2 升級裁量、handoff 時戳驗證、takeover worktree、schedule-report 讀 phase
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
  - .claude/skills/dispatch/SKILL.md
  - .claude/skills/handoff/SKILL.md
  - .claude/skills/review-round/SKILL.md
  - .claude/skills/takeover/SKILL.md
  - .claude/skills/schedule-report/SKILL.md
  - scripts/gen-schedule.mjs
acceptance:
  - F-12/F-06：dispatch 的提示詞固定三行（任務卡路徑；依角色檔執行；回報五行），並明文「提示詞不重述規格內容，只指向卡與規格檔；規格與提示詞衝突時規格優先」；開發卡提示詞加 worktree 路徑
  - F-05：dispatch 備援段保留並精簡
  - F-02/F-14：review-round 加「合併後 git worktree remove 與 branch -d」與「Leader 裁量：失敗原因為工具操作而非能力時可於 r2 升級模型並記錄於審核紀錄表」
  - F-04/F-19：handoff 加「commit 訊息寫檔 -F」與「收尾前 grep 驗證 A 段開工時間、B 段完工時間格式為 yyyy-mm-ddTHH:MM:SS+08:00」
  - F-02：takeover 加 worktree 建立步驟
  - F-17：gen-schedule.mjs 優先讀任務卡 `phase`（extract-cards.sh 一併輸出 phase 欄；缺則回退 phaseById／phaseByTeam）；schedule-report SKILL 同步說明；重跑 E-001 產生器結果與現況一致（30 卡、9 階段）
  - 只改 outputs；每個變更在交接檔逐項對應到 F 編號；不改任何 tasks/T-00xx 卡與 docs/specs
  - 文字精簡：角色檔／模板／skill 每檔淨增不超過 60 行，重複內容移到共用段
reviewer: leader
branch: null
created: 2026-09-19T18:16:31+08:00
updated: 2026-09-19T18:16:31+08:00
blocked_reason: null
---

## 目標

讓流程技能反映實際運作方式，Leader 派工成本降到三行。

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
