---
id: T-0032
title: 角色檔 v1.1：共用環境注意段、qa-uat 認證程序、dev-ops 陷阱、dev-tl 安全判準、leader 備援與介入紀錄
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
  - .claude/agents/plan-ba.md
  - .claude/agents/plan-sa.md
  - .claude/agents/plan-sd.md
  - .claude/agents/dev-tl.md
  - .claude/agents/dev-be.md
  - .claude/agents/dev-fe.md
  - .claude/agents/dev-ops.md
  - .claude/agents/qa-lead.md
  - .claude/agents/qa-cr.md
  - .claude/agents/qa-at.md
  - .claude/agents/qa-uat.md
  - .claude/agents/leader.md
acceptance:
  - F-01/03/04/13/15：12 個角色檔的通用協定新增「環境注意」小節（單引號、python、worktree 路徑慣例、commit -F、只 add 自己的檔、Docker 不可用備援、等待外部事件超過 2 次即回報、回報五行），措辭一致
  - F-07：qa-uat frontmatter model 改 sonnet；加「瀏覽器認證程序」與「阻擋須附網路面板狀態碼與 URL 證據，否則不得標阻擋」
  - F-08：qa-at、qa-uat 加「只動自己建立的資料；staging 共用時錯開或加前綴」
  - F-10：dev-ops 加「Windows／PowerShell／cmd 常見陷阱」小節（六條）
  - F-11：qa-cr 引用 CR 模板已知例外清單
  - F-16：dev-tl 加「安全邊界判準以 SD §6 為準，不以第三方已擋放行」
  - F-05/F-23：leader.md 加「同 session 新建角色定義的備援派工寫法」與「Leader 直接介入基礎設施或程式時，必須在 Epic 裁決紀錄留下時間、指令、理由、revision／commit」
  - 只改 outputs；每個變更在交接檔逐項對應到 F 編號；不改任何 tasks/T-00xx 卡與 docs/specs
  - 文字精簡：角色檔／模板／skill 每檔淨增不超過 60 行，重複內容移到共用段
reviewer: leader
branch: null
created: 2026-09-19T18:16:31+08:00
updated: 2026-09-19T18:16:31+08:00
blocked_reason: null
---

## 目標

讓執行者只靠角色檔就掌握全部環境限制與禁止事項，Leader 派工提示詞回到固定三行。

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
