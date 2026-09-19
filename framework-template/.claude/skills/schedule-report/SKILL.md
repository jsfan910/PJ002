---
name: schedule-report
description: 產出可列印的專案時程表（WBS 表 + 甘特圖）HTML，資料自動取自任務卡 frontmatter 與交接檔各輪開工／完工時戳，並發布為同一個 Artifact 網址。用法：/schedule-report [E-###] [--date yyyy-mm-dd] [--no-publish]。
---

# /schedule-report — 專案時程表（WBS + 甘特圖）

產出物：`docs/專案時程表_{date}.html`（白底、可深色切換、A4 橫向可列印）。內容：KPI、WBS 表（依階段分組，含派工／完成／歷時／狀態）、甘特圖（兩層：階段列／任務列 + 派工／完成／狀態欄、進度長條、審核回合斜線段、獨立里程碑列、現在時間線）。時間軸依資料自動取範圍，跨 36 小時自動改成日刻度。

## 輸入

- 任務卡：`tasks/T-*.md` frontmatter（id、title、team、role、status、**phase**、round、depends_on、created、updated）。
- 交接檔：`worklog/handoff/*-T####-r{n}-{role}.md` 的 A 段「開工時間：」與 B 段「完工時間／狀態：」。執行者本人的段是工作段，其他角色（審核者）的段是審核段。
- 設定檔：`docs/schedule/{Epic}.json`（範例 `docs/schedule/example.json`）：
  - `title`、`tz`、`epicStatus`、`staging`、`output`（可含 `{date}`）
  - `phases`：階段順序與標籤（`key` 即任務卡 `phase:` 可填的值）；`phaseByTeam`：團隊預設階段；`phaseById`：舊卡補寫用的階段對照
  - `extraCards`：不在 tasks/ 的項目（例如 Leader 的 Phase 0）
  - `gates`：里程碑 `{t, label}`；`notes`：圖下備註
  - `artifactUrl`：已發布過的 Artifact 網址（重新發布時用同一網址）

## 步驟

1. **抽資料**：`bash scripts/extract-cards.sh docs/schedule/cards.txt`（輸出管線分隔文字）。
2. **更新設定檔**：若有新的關卡／里程碑、Epic 狀態、staging 網址，先改 `docs/schedule/{Epic}.json`。階段歸屬不必動設定檔 —— 正常做法是在任務卡 frontmatter 寫 `phase:`（值取 `phases[].key`），建卡當下就決定，不另維護一份對照表。
3. **產生**：`node scripts/gen-schedule.mjs docs/schedule/{Epic}.json docs/schedule/cards.txt --date {yyyy-mm-dd}`。同日重跑會覆蓋同名檔；換日產生新檔，舊檔依產出規則移入 `docs/archive/` 並登錄 `_index.md`。
4. **看一次**：用瀏覽器開本機檔案，以 JS 檢查（不要反覆截圖）：深色模式下 `#wbs td` 文字為白、`#msaxis .m` 數量等於 gates 數、無主控台錯誤。
5. **發布**（除非 `--no-publish`）：以 Artifact 工具發布同一個 `file_path`；本對話首次發布過即沿用網址，否則傳 `url: artifactUrl`。首次發布 `icon: calendar`。
6. **記錄**：commit `docs/專案時程表_{date}.html`、`docs/schedule/{Epic}.json`、`docs/schedule/cards.txt`；在每日交接檔加一行含 Artifact 網址。

## 規則

- **階段歸屬優先序**：任務卡 `phase:` → 設定檔 `phaseById` → `phaseByTeam` → 該卡 `team`（未知鍵排在最後）。卡上有 `phase` 就贏，設定檔不覆蓋它；要改某卡的階段，改卡不改設定檔。`phaseById` 只留給沒有 `phase:` 欄的舊卡，新卡不要往裡加。
- 派工時間 = 該卡第 1 輪工作段的開工時間（同批建卡的 `created` 相同，不用它）；完成時間 = 判 done 時的 `updated`。
- 進度填滿比例固定：done 100%、review 90%、in_progress 50%、blocked 30%、todo 不畫。
- 憑證與網址：`staging` 只放主機名；報告不含任何帳密。
- 產生器與抽取腳本是唯一事實來源，不要手改 HTML；要改版面改 `scripts/gen-schedule.mjs` 再重跑。
- 本環境 Bash 指令不可含 ASCII 單引號（腳本檔內不受限）。
