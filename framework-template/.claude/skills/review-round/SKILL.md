---
name: review-round
description: 審核者（任務卡 reviewer 角色）或 Leader 使用。對 status=review 的任務卡執行一輪審核：實際跑驗證、逐條對照驗收條件、判定 done/rework/blocked、更新回合數與審核紀錄；第 3 輪不過自動產生升級單。用法：/review-round T-0012。
---

# /review-round — 審核一輪

審核者不採信交接檔的「通過」二字，只採信自己重跑得到的輸出。

## 步驟

1. 讀任務卡（確認 `status: review`、自己是 `reviewer` 或 Leader）、本輪交接檔 B 段、`acceptance`、「驗收方式」。
2. 依自己的角色定義建立審核交接檔 `worklog/handoff/yyyymmdd-HHmm-T####-r{round}-{reviewer}.md`，A 段寫「審核 T-####」。
3. **實際執行**驗收方式的每條指令（開發卡先 checkout 分支）。輸出貼進自己的交接檔 B 段。
4. 逐條判定 `acceptance`：通過／不通過（附證據）。對交接檔「假設與決策」逐條表態：接受／不接受（附理由）。
5. 判定：
   - 全部通過 → 任務卡 `status: done`，`updated` 更新；審核紀錄表加一列 `r{n} | {reviewer} | done | 摘要 | 交接檔路徑`。Leader 於 `tasks/_done.md` 追加一列：`| 卡號 | 標題 | 角色 | 派工時間（r1 交接檔 A 段開工時間） | 完成時間（updated） | 回合 | 審核／備註 |`。開發卡由 dev-tl 合併並更新 CHANGELOG，合併後清理工作區（在主 repo 根目錄執行，不在 worktree 內）：
     ```bash
     git worktree remove ../{repo}-T####
     git branch -d task/T-####-{slug}
     git worktree prune
     ```
     worktree 有未提交變更時 `remove` 會拒絕：先確認那些變更不需要保留，再加 `--force`；分支未完全合併時 `-d` 會拒絕，先確認 merge 已進 main 再處理，不要直接 `-D`。
   - 有不通過 且 `round < 3` → `status: rework`，`round` +1；審核紀錄表加一列，摘要必須列出「具體要改哪裡」；Leader 重派（`/dispatch T-####`）。
   - 有不通過 且 `round == 3` → `status: blocked`，`blocked_reason: 3輪未過`；依 `docs/templates/escalation.md` 寫 `docs/reports/yyyymmdd-HHmm-升級-T####.md`（五段齊全），路徑寫進審核紀錄表；交 Leader。
   - 第 3 輪重派時，`model` 自動升一級（haiku→sonnet→opus→fable）並在卡「背景與限制」註明。
6. **Leader 裁量：提前於 r2 升級模型**。r1 失敗原因若是「工具操作／環境誤判」而非「能力不足」（例：把瀏覽器認證快取誤判為系統阻擋、反覆自我輪詢背景工作、指令語法踩環境限制），Leader 可在 r2 重派時就升一級，不必等第 3 輪。判準：同一份輸入換模型有合理機會一次過，而不是要改規格或改設計。
   - 升級必須留痕：審核紀錄表該列摘要註明「r2 升級模型 {舊}→{新}，理由：{工具操作類失敗的具體現象}」，並同步改任務卡 `model` 與「背景與限制」。
   - 反例：失敗原因是規格理解錯、驗收條件本身有歧義、或產出方向不對 —— 這是回退重做，不是升級。
7. 產出對應報告（若角色要求）：qa-cr 寫 CR 報告、qa-lead 更新缺陷清單。
8. 回報五行。

## Leader 收到升級單後

- 能裁決：把決定寫進任務卡「背景與限制」，`round` 歸 1，`status: todo`，重派。
- 不能裁決：彙整進下一份 Gate 報告第 3 段，或立即以「結論／重點摘要／裁決項／連結」四段回報使用者。
