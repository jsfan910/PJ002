---
id: T-0033
title: 模板 v1.1：任務卡加 phase、Epic 模板、交接檔時戳標準化、測試計畫環境獨占、部署模板採樣來源與 secret 釘版
epic: E-002
team: leader
role: leader
model: opus
phase: framework
status: review
round: 1
depends_on: []
inputs:
  - tasks/E-002-framework-v1.1.md（發現清單，本卡負責的 F 項）
  - tasks/E-001-todo-app.md（Leader 裁決紀錄全文，事實來源）
  - CLAUDE.md（協作協定、工作鐵則）
  - docs/團隊協作計畫書_20260919.md
outputs:
  - docs/templates/task_card.md
  - docs/templates/worklog_handoff.md
  - docs/templates/epic.md（新增）
  - docs/templates/qa_07_測試計畫.md
  - docs/templates/spec_06_部署架構與CICD.md
  - docs/templates/dev_11_README.md
  - docs/templates/gate_report.md
acceptance:
  - F-17：task_card frontmatter 加 `phase:`（註解列出常用值：plan / dev-plan / qa-plan / dev / qa / dev-fix / staging / qa-staging / ops / framework）與 `branch` 說明改為 worktree 路徑慣例
  - F-18：epic.md 依 tasks/E-001-todo-app.md 結構抽象化（目標、原始需求、範圍 P0/P1/範圍外、限制、成功指標、任務卡表、Leader 裁決紀錄格式）
  - F-19/F-20：worklog_handoff A 段「開工時間：」與 B 段「完工時間／狀態：」格式固定為 `yyyy-mm-ddTHH:MM:SS+08:00`，並註明「schedule-report 與 _done.md 依此欄抽取，不得改寫欄名或格式」
  - F-08/F-22：qa_07 加「環境獨占與資料隔離」節與「環境未就緒的 TC 記『阻擋（環境未就緒）』不記不通過」固定寫法
  - F-09/F-21：spec_06 第 4 章加「secret 建議釘具體版本；verify 失敗自動重建 revision」，第 6 章加「可用性採樣須有平台原生 uptime check，CI 排程只作備援」
  - F-10：dev_11_README 加「指令在哪裡執行」段落骨架（Cloud Shell／本機 SDK、Windows 陷阱）
  - gate_report 第 3 章加「Gate 判定本身的選項表」骨架（依 Gate 2 r1 報告寫法）
  - 只改 outputs；每個變更在交接檔逐項對應到 F 編號；不改任何 tasks/T-00xx 卡與 docs/specs
  - 文字精簡：角色檔／模板／skill 每檔淨增不超過 60 行，重複內容移到共用段
reviewer: leader
branch: null
created: 2026-09-19T18:16:31+08:00
updated: 2026-09-19T18:20:43+08:00
blocked_reason: null
---

## 目標

讓下一個 Epic 從建 Epic、建卡、交接、測試計畫到部署設計都有含本次教訓的模板。

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
| 1 | leader | 待審 | 7 檔（6 改 1 新增），淨增 216 行；F-08/09/10/17/18/19/20/21/22 與 gate_report 骨架全部落點 | worklog/handoff/20260919-1817-T0033-r1-leader.md |
