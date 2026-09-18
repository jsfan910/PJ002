---
name: handoff
description: 任一角色收尾時使用。核對驗收條件、實際執行驗證指令、填寫交接檔 B 段、更新任務卡狀態與時間、commit。用法：/handoff T-0012 [review|blocked]。
---

# /handoff — 收尾交接

判準：換一個 agent 明天早上只讀「任務卡 + 交接檔 B 段」，能不能直接開工？不能就是還沒交接完。

## 步驟

1. 找到本卡本輪的交接檔 `worklog/handoff/*-T####-r{round}-{role}.md`（開工時已建，含 A 段）。沒有就先依模板補建 A 段（註明「補建」）。
2. 逐條核對任務卡 `acceptance`。對每條**實際執行**驗收方式的指令，把指令與真實輸出貼進 B 段「驗證方式」。任一條不過：不得標 `review`，改標 `blocked` 或繼續修。
3. 填 B 段全部欄位。空的欄位寫「無」，不留空白。特別注意：
   - 「假設與決策」：每個你自己決定的事都要寫，含理由；
   - 「需要 Leader 裁決的事」：無法決定的事寫這裡，不要埋在正文。
4. 任務卡 frontmatter：`status` 改為指定值（預設 `review`）、`updated` 取實查系統時間；`blocked` 時填 `blocked_reason`。
5. Git：
   - 開發卡：`git add` 本卡 `outputs` 與交接檔、任務卡；在 `task/T-####-slug` 分支 commit，訊息 `T-####: 摘要`。
   - 文件卡：直接在 `main` commit。
   - 不 commit 任何 `.env`、憑證、暫存檔。
6. 回報五行：`狀態｜產出路徑｜交接檔路徑｜需裁決事項（無則寫無）｜下一步`。
