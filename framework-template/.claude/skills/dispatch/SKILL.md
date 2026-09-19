---
name: dispatch
description: Leader 專用。依 Epic 說明或 WBS 建立任務卡、檢查依賴與 outputs 不重疊、更新看板 tasks/_todo.md，並（方式 A）以子代理平行啟動可開工的卡。用法：/dispatch <Epic 或 WBS 路徑或「T-0012 T-0013」>。
---

# /dispatch — 派工

只有 Leader 執行。任務卡是狀態事實來源，看板只是彙整。

## 步驟

1. **決定要建哪些卡**
   - 輸入是 Epic 說明：建規劃團隊三張卡（plan-ba → plan-sa → plan-sd，串行依賴），外加一張 `plan-ba` 反向審核 SD 的卡（依賴 plan-sd 卡）。
   - 輸入是 `docs/specs/10_開發計畫_WBS.md`：每個工作項一張卡，`depends_on` 照 WBS，`reviewer: dev-tl`。
   - 輸入是測試總結報告的缺陷清單：每個 S1/S2 缺陷一張修正卡（`team: dev`），並把原卡 `round` +1 的邏輯記在新卡「背景」。
   - 輸入是既有卡 ID 清單：跳到步驟 4。
2. **編號**：讀 `tasks/` 現有最大 `T-####` +1。ID 永不重用。
3. **建卡**：複製 `docs/templates/task_card.md`，填滿 frontmatter 與正文。檢查：
   - `inputs` 精確到段落錨點（`path#anchor`）；
   - `outputs` 與所有 `status ∈ {in_progress, review, rework}` 的卡無交集，有交集就改依賴或合併卡；
   - `acceptance` 每條可驗（有指令或檢查清單）；
   - `model` 依 CLAUDE.md 模型表；`created`/`updated` 取實查系統時間。
4. **更新看板** `tasks/_todo.md`：依 frontmatter 重新彙整「進行中／審核中／阻塞／待辦」四張表格（欄位：卡號｜標題｜角色／模型｜回合｜派工時間｜備註）。引言區（第一個 `## ` 之前）只放一行指向當日交接檔 `worklog/handoff/yyyymmdd-工作交接.md`，不放內容。
5. **啟動**（方式 A）：對每張 `depends_on` 全 `done` 且 `status: todo` 的卡，以 Agent 工具啟動對應 `.claude/agents/{role}.md`，`run_in_background: true`，無依賴者同一則訊息一起啟動。提示詞固定三行：
   ```
   任務卡：tasks/T-####-{slug}.md
   依你的角色定義執行；開工先寫 worklog A 段，收尾寫 B 段並把任務卡 status 改為 review 或 blocked。
   回報只寫五行：狀態｜產出路徑｜交接檔路徑｜需裁決事項｜下一步。
   ```
   開發卡（`team: dev`，有 `branch`）在第一行後插入 worktree 路徑一行，仍算固定格式：
   ```
   worktree：../{repo}-T####（分支 task/T-####-{slug}；根目錄永遠 main，不在根目錄改程式）
   ```
6. **記錄**：在 Leader 的當日 worklog 追加一行「派工：T-#### … 啟動於 HH:MM」。

## 提示詞鐵則

- **只指向、不重述**：提示詞只給任務卡路徑與（必要時）規格檔路徑，不複製規格內容（狀態碼、欄位、階段順序、閾值一律不寫）。環境限制、回報格式、禁止事項已在角色檔，不重複。
- **規格優先於提示詞**：提示詞與凍結規格衝突時，執行者依規格實作並在交接檔「假設與決策」註明，不需回問 Leader。框架首輪試跑已兩次驗證（UUID 格式錯應回 400 而非提示詞誤寫的 404；部署階段順序以 06 §3.2 為準）。
- 提示詞寫錯是 Leader 的事：發現後由 Leader 追認於 Epic 裁決紀錄，不退卡。

## 子代理回報後

- 以任務卡與交接檔為準，不以回報為準。讀交接檔 B 段。
- `status: review` → 執行 `/review-round T-####`（由 reviewer 角色審）。
- `status: blocked` → Leader 裁決；能裁決就寫進卡的「背景與限制」並改回 `todo` 重派；不能就寫升級單。

## 備援：Agent 工具找不到角色名稱時

`.claude/agents/` 於 session 啟動時載入，本 session 新建的定義要下個 session 才出現。改用 `subagent_type: general-purpose`，`model` 取角色檔 frontmatter，提示詞第一行加：

```
先讀 .claude/agents/{role}.md，整份視為你的角色指令（含通用協定），再執行下列任務卡。
```
