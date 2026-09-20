---
id: T-0047
title: Release Notes v0.1.0 附註更正：staging 現況（流量事故）、D-017／D-018 結果、TC-090 有效量測
epic: E-001
team: dev
role: dev-tl
model: opus
phase: dev
status: done
round: 1
depends_on: [T-0045, T-0046]
inputs:
  - docs/specs/14_ReleaseNotes.md（v0.1.0 現行內容；「本版定位」段與已知限制 KL 清單）
  - docs/reports/20260920-2145-測試總結-E001-r4.md#1、#4、#5（最終數字、R-14／R-16、剩餘條件）
  - docs/reports/20260920-2042-流量釘死事故-E001.md（事故摘要與影響範圍）
  - docs/specs/06_部署架構與CICD.md#6.10
  - CHANGELOG.md（[Unreleased] 現有 T-0044／T-0045 條目）
outputs:
  - docs/specs/14_ReleaseNotes.md（新增「v0.1.0 附註（2026-09-20）」段；更新已知限制清單；frontmatter updated）
  - CHANGELOG.md（[0.1.0] 區塊下加「附註」子段，說明 tag v0.1.0 當時 staging 實際服務的 revision 與之後的修正）
acceptance:
  - Release Notes 附註寫明：tag v0.1.0（ddc66bb）當時 staging 流量釘在 todo-app-00003-lt2（2026-09-19 16:05 建置），v0.1.0 程式於 2026-09-20 21:2x 才隨 T-0045 真正上線（revision 00019-k5q／00020-z8j）；D-017 已關閉（40/40）、D-018 立案並關閉、TC-090 以 T-0045 真實重測為準；不改寫原文，只追加附註
  - 已知限制清單更新：移除 D-017、staging 舊版兩項；保留 Firefox（TC-091）、TC-080 直接比對、D-014、unit 6 條部分覆蓋；新增「QA Tests workflow 連續紅燈根因未定，該工作流綠燈暫不作為判定依據」
  - CHANGELOG [0.1.0] 附註子段與 Release Notes 一致；不建立新 tag（v0.1.0 不動，附註以文件說明）
  - `git diff --stat main...task/T-0047-release-notes-addendum` 只含 outputs 兩檔
reviewer: leader
branch: task/T-0047-release-notes-addendum
created: 2026-09-20T21:55:00+08:00
updated: 2026-09-20T22:04:00+08:00
blocked_reason: null
---

## 目標

讓 Release Notes 與 CHANGELOG 反映事實：v0.1.0 定版當時 staging 並未服務新程式，事故已修，D-017／D-018 結果如何。追加、不改寫。

## 背景與限制

- 上游：T-0045 事故、T-0046 測試總結 r4 裁決事項 D。
- 下游：Gate 2 r2 附錄／P1 起點。
- 必須遵守：CLAUDE.md 協作協定；角色檔 `.claude/agents/dev-tl.md`；**在 git worktree `<根目錄>-wt/T-0047` 內作業**，合併回 main 由 dev-tl 自己執行，本卡合併後可推送。

## 驗收方式

Leader：`grep -n "附註" docs/specs/14_ReleaseNotes.md CHANGELOG.md | head`；核對 revision 名稱與日期與 06 §6.10 一致。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | leader | **done** | 四條 acceptance 全通過。附註只追加不改寫：兩檔 **+111／−1**，唯一刪除行為 Release Notes frontmatter 的 `updated`；`git tag -l` 仍只有 `v0.1.0`（未重打）。**兩項偏離經明文追認**：①acceptance 字面的「21:2x 隨 T-0045 上線（`00019-k5q`／`00020-z8j`）」改為**三個時間點全列並標明 `todo-app-00018-xq4`（2026-09-20 20:44:51）為精確起點**——佐證為 `git merge-base --is-ancestor ddc66bb 854c843`（該 revision 的來源 commit 是定版 commit 的後代）與 `git diff --name-only ddc66bb 712b4a3 -- src public` = 0 行；②「移除 D-017、staging 舊版兩項」改以「§3 原文保留供追溯 ＋ §3 章首與 §7.4 宣告已解除並給取代性清單」實現，不刪除原列。合併 merge commit `41e5ba1`（`--no-ff`），`[Unreleased]` 已補 T-0047 條目，worktree 與分支已清理 | `worklog/handoff/20260920-2154-T0047-r1-dev-tl.md`（dev-tl）／`worklog/handoff/20260920-2158-T0047-r1-leader.md`（leader） |
