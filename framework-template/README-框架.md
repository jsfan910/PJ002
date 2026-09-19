# AI Agent 軟體開發團隊 — 框架範本

這個目錄是一套**可直接套用到任何新專案**的協作框架：12 個角色定義、5 個流程技能、25 份文件模板、目錄骨架、看板與時程表工具，以及把這些綁在一起的規則（`CLAUDE.md`）。

它**不含任何專案內容**——沒有需求、沒有規格、沒有程式碼、沒有雲端資源。複製過去就是一個乾淨的起點。

---

## 新專案起手式（六步）

1. **複製**：把本目錄的**全部內容**（含 `.claude/`、`.gitignore` 這些隱藏檔）複製到新的專案資料夾。

   ```bash
   cp -r framework-template/. /path/to/my-new-project/
   ```

   或在 GitHub 上把本目錄做成 template repository，之後 “Use this template”。

2. **改名**：把新資料夾命名成你的專案名。目錄名沒有格式限制；`docs/團隊協作計畫書.md` 第 3 章的目錄圖用 `{專案根目錄}` 當佔位符，不必改。

3. **納入版控**：

   ```bash
   cd /path/to/my-new-project
   git init
   git add -A
   git commit -m "chore: 從框架範本建立專案"
   ```

   版控不是選配。任務卡的「每卡一分支 + git worktree」規則、CHANGELOG、回滾都建立在 git 上。

4. **確認工具鏈**（缺的等到用得上再補）：

   | 工具 | 用途 | 檢查 |
   |---|---|---|
   | git | 版控、worktree | `git --version` |
   | Node.js 20+ | 時程表產生器 `scripts/gen-schedule.mjs`；多數專案的前端／後端 | `node -v` |
   | Bash | `scripts/*.sh`（Windows 用 Git Bash） | `bash --version` |
   | Docker | 容器化與本機整合測試（僅容器化專案需要） | `docker info` |
   | 雲端 CLI | 部署 staging（由系統設計階段決定平台） | 依平台 |

5. **開一個新的 Claude Code session**。`.claude/agents/*.md` 是在 **session 啟動時載入**的，直接在舊 session 複製檔案叫不到新角色。先複製檔案，再開 session。

6. **對 Leader 說你的需求**。Leader 會建 Epic 與任務卡，然後派工。
   **Phase 0（框架建置）在本範本已經完成，直接從 Phase 1 開始。** 你在整個流程裡只會被問三次：① 計畫書 ② Gate 1 規格包 ③ Gate 2 可運行程式＋測試報告（另加 3 輪未過時的升級單）。

---

## 目錄說明

| 路徑 | 是什麼 | 誰寫 |
|---|---|---|
| `CLAUDE.md` | 專案規則：語言、產出規則、文件地圖、協作協定摘要、回報規則、收工規則、**工作鐵則** | Leader |
| `docs/團隊協作計畫書.md` | 框架的完整定義：團隊架構、必產文件與 DoD、模型等級、流程、Gate、風險 | Leader（使用者介入點 ①） |
| `.claude/agents/` | 12 個角色定義（leader／plan-ba・sa・sd／dev-tl・be・fe・ops／qa-lead・cr・at・uat） | 框架，通常不動 |
| `.claude/skills/` | 5 個流程技能：`dispatch`（派工）、`handoff`（收尾交接）、`review-round`（審核一輪）、`takeover`（獨立 session 接手）、`schedule-report`（時程表） | 框架，通常不動 |
| `docs/templates/` | 25 份文件模板：任務卡、交接、升級單、Gate 報告、SRS／SA／SD／API／DB／部署、WBS／README／CHANGELOG／Release Notes、測試計畫／案例／CR／AT／UAT／缺陷／總結、ADR、追溯矩陣 | 框架，Phase 2 才修 |
| `tasks/` | 任務卡（事實來源）＋看板 `_todo.md`／`_done.md`（只有 Leader 寫） | Leader ＋各卡 assignee |
| `docs/specs/` | 規格文件包，Gate 1 後凍結 | 規劃團隊 |
| `docs/reports/` | 給決策者看的報告（Gate 報告、升級單）。不是事實來源 | Leader、QA |
| `docs/archive/` | 被取代的舊版文件，登錄檔 `_index.md`。**僅供歷史查閱，禁止引用** | 誰封存誰登錄 |
| `docs/schedule/` | 時程表設定檔。`example.json` 是空 Epic 範例，複製成 `{Epic}.json` 再填 | Leader |
| `worklog/handoff/` | 任務卡交接檔（每卡每輪一份）與每日交接 | 每檔只由產生者寫 |
| `worklog/daily_summary/` | 收工日報 | Leader |
| `scripts/` | `extract-cards.sh`（抽任務卡與時戳）、`gen-schedule.mjs`（產 WBS＋甘特圖 HTML）、`export-framework.sh`（重新匯出本範本） | — |
| `src/`、`tests/`、`ref/` | 程式碼、測試、使用者提供的參考資料。實際結構由系統設計階段決定 | 開發／測試團隊 |

產時程表：

```bash
bash scripts/extract-cards.sh docs/schedule/cards.txt
node scripts/gen-schedule.mjs docs/schedule/{Epic}.json docs/schedule/cards.txt
```

（零張任務卡時也能跑，會產生一張空表。）

---

## 不包含什麼

- **任何專案的需求、規格、程式碼、測試、雲端設定。** `docs/specs/`、`src/`、`tests/` 都是空的（只有 `.gitkeep`）。
- **`.claude/settings.local.json`**（個人權限設定，本來就不入版控）。你的新專案第一次跑工具時會自己建。
- **CI/CD workflow 檔。** 計畫書預設 GitHub Actions，但實際的 `.github/workflows/*` 由 dev-ops 依該專案的部署架構產生。
- **技術棧的任何預設。** 語言、框架、資料庫、雲端平台一律由系統設計階段依需求決定，並寫成 ADR。
- **歷史紀錄。** `CLAUDE.md` 的「工作鐵則」與計畫書附錄 B 變更紀錄裡的括號案例，是框架首輪試跑留下的**經驗來源說明**，不是你專案的事實；保留它們是因為那些坑下一個專案還會踩。

---

## 怎麼更新框架

框架本身有改進時（角色檔、模板、技能、計畫書、鐵則），在**框架來源 repo** 改，然後重跑：

```bash
bash scripts/export-framework.sh <目標目錄>
```

腳本會**清空目標目錄**再重建，所以不要直接匯出到已經有專案內容的資料夾。
已經在跑的專案要吃到框架更新，就手動挑檔案覆蓋（通常只有 `.claude/agents/`、`.claude/skills/`、`docs/templates/`），並依計畫書第 9 章的界線：**框架修正不回頭套用到進行中的 Epic**，由下一個 Epic 驗證。
