---
name: takeover
description: 獨立 session 接手某張任務卡（方式 B）。讀任務卡與最近交接檔、載入對應角色定義、建立本輪 worklog A 段後開工。用法：/takeover T-0012。
---

# /takeover — 獨立 session 接手

適用：Leader session 已滿、需要人為觀察、或要換模型重跑。接手後行為與子代理完全相同，紀錄格式相同。

## 步驟

1. 讀 `tasks/T-####-*.md`。檢查：
   - `status ∈ {todo, rework}`（`in_progress` 表示別的 session 正在做，除非該卡 `updated` 超過 24 小時且無交接檔更新，否則不接）；
   - `depends_on` 全 `done`；
   - 不符則停止並回報原因。
2. 讀本卡所有交接檔（`worklog/handoff/*T####*`），最近一份的 B 段與審核紀錄表最後一列是本輪的起點。
3. 讀 `.claude/agents/{role}.md`，**整份視為本 session 的角色指令**（含通用協定）。
4. 讀 `CLAUDE.md`「協作協定」段落。
5. 依模板建立本輪交接檔並填 A 段（註明「takeover，session 手動接手」）；任務卡 `status: in_progress`、`updated` 更新。
6. 開工。收尾用 `/handoff T-####`。
