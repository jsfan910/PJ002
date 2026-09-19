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
6. **開發卡：先建 git worktree，再動任何程式碼**。根目錄永遠停在 main，不在根目錄改程式。在主 repo 根目錄執行：
   ```bash
   git worktree add ../{repo}-T#### -b task/T-####-{slug} main
   cd ../{repo}-T####
   git status
   ```
   - 卡上 `branch` 已有值（rework 或別的 session 開過）：改用既有分支，不要 `-b`。
     `git worktree add ../{repo}-T#### task/T-####-{slug}`
   - 路徑已存在但沒掛上：先 `git worktree prune`，再重建。
   - 建好後把路徑與分支寫回任務卡 `branch` 與本輪交接檔 A 段，之後所有指令都用這個絕對路徑（agent 的工作目錄在每次 Bash 呼叫之間會重置）。
   - 文件卡（`docs/`、`tasks/`、`.claude/`、`worklog/`）不建 worktree，直接在根目錄 main 作業。
7. 開工。收尾用 `/handoff T-####`（含時戳格式驗證與 commit `-F`）；開發卡合併與 worktree 清理由 `/review-round` 判 done 時處理。
