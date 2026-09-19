---
id: T-0000
title: （一句話說明任務）
epic: E-000
team: plan            # plan | dev | qa | leader
role: plan-ba         # plan-ba | plan-sa | plan-sd | dev-tl | dev-be | dev-fe | dev-ops | qa-lead | qa-cr | qa-at | qa-uat | leader
model: opus           # haiku | sonnet | opus | fable（依 CLAUDE.md 平衡模式表；第 3 輪自動升一級）
phase: plan           # 本卡屬於哪個階段。常用值：
                      # plan（規格） | dev-plan（WBS） | qa-plan（測試計畫／案例）
                      # | dev（開發） | qa（測試） | dev-fix（測試後修正）
                      # | staging（部署補驗） | qa-staging（staging 重跑）
                      # | ops（維運改善） | framework（框架／模板本身）
                      # 必填：時程表（/schedule-report）以本欄分組，缺欄會退回另建對照表
status: todo          # todo | in_progress | review | rework | blocked | done | cancelled
round: 1              # 1..3；每次進入 rework 時 +1；達 3 仍未過 → blocked + 升級單
depends_on: []        # 例：[T-0001, T-0002]；全部 done 才可啟動
inputs:               # 必讀輸入，精確到段落錨點
  - docs/specs/01_需求規格書_SRS.md#US-001
outputs:              # 本卡產出路徑；不得與其他 in_progress 卡重疊
  - docs/specs/02_系統分析書_SA.md
acceptance:           # 驗收條件；審核者逐條驗
  - （條件 1）
  - （條件 2）
reviewer: plan-sd     # 審核角色
branch: null          # 開發卡填 task/T-0000-slug，且**必須在 git worktree 內作業**：
                      # git worktree add "<專案根目錄>-wt/T-0000" -b task/T-0000-slug
                      # 所有檔案操作／npm／docker／測試／commit 都在該 worktree 內；
                      # 專案根目錄永遠停在 main（供文件卡與 Leader 使用）。
                      # 合併由 dev-tl 在根目錄 git merge --no-ff，之後 git worktree remove。
                      # 文件卡（只動 docs/、tasks/、.claude/）填 null，直接在 main commit。
created: 2026-01-01T00:00:00+08:00
updated: 2026-01-01T00:00:00+08:00
blocked_reason: null  # blocked 時填原因；升級單路徑寫在審核紀錄表
---

## 目標

（一段話：做什麼、為什麼、對誰有價值）

## 背景與限制

- 上游：（這張卡的輸入來自哪張卡／哪份文件）
- 下游：（誰會用這張卡的產出）
- 必須遵守：（ADR 編號、不可動的介面、既有慣例）

## 驗收方式

（審核者要「怎麼驗」：具體指令、檢查清單、預期輸出。不可只寫「確認正確」。）

```bash
# 例：pytest tests/unit -q
```

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| | | | | |
