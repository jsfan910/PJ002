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
   - 全部通過 → 任務卡 `status: done`，`updated` 更新；審核紀錄表加一列 `r{n} | {reviewer} | done | 摘要 | 交接檔路徑`。開發卡由 dev-tl 合併並更新 CHANGELOG。
   - 有不通過 且 `round < 3` → `status: rework`，`round` +1；審核紀錄表加一列，摘要必須列出「具體要改哪裡」；Leader 重派（`/dispatch T-####`）。
   - 有不通過 且 `round == 3` → `status: blocked`，`blocked_reason: 3輪未過`；依 `docs/templates/escalation.md` 寫 `docs/reports/yyyymmdd-HHmm-升級-T####.md`（五段齊全），路徑寫進審核紀錄表；交 Leader。
   - 第 3 輪重派時，`model` 自動升一級（haiku→sonnet→opus→fable）並在卡「背景與限制」註明。
6. 產出對應報告（若角色要求）：qa-cr 寫 CR 報告、qa-lead 更新缺陷清單。
7. 回報五行。

## Leader 收到升級單後

- 能裁決：把決定寫進任務卡「背景與限制」，`round` 歸 1，`status: todo`，重派。
- 不能裁決：彙整進下一份 Gate 報告第 3 段，或立即以「結論／重點摘要／裁決項／連結」四段回報使用者。
