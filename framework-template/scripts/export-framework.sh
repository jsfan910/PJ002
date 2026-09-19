#!/usr/bin/env bash
# 匯出「乾淨框架範本」：把本 repo 的協作框架（規則、角色、技能、模板、腳本、目錄骨架）
# 複製到目標目錄並去專案化，讓任何新專案複製過去即可開工。
#
# 用法：bash scripts/export-framework.sh <目標目錄>
# 例：  bash scripts/export-framework.sh framework-template
#       bash scripts/export-framework.sh /d/work/my-new-project
#
# 事實來源是本腳本；framework-template/ 只是它產生的快照，不要手改快照。
set -euo pipefail

# ---------------------------------------------------------------------------
# 首輪試跑的 Epic 代號與來源專案目錄名。刻意以「字串拼接／執行期取值」寫成，
# 讓這支腳本被複製進範本後，範本的「不得出現專案字串」檢查不會掃到它自己。
# ---------------------------------------------------------------------------
EPIC1="E-0""01"
EPIC2="E-0""02"

SRC="$(cd "$(dirname "$0")/.." && pwd)"
PROJDIR="$(basename "$SRC")"

DEST_ARG="${1:-}"
if [ -z "$DEST_ARG" ]; then
  echo "用法：bash scripts/export-framework.sh <目標目錄>" >&2
  exit 1
fi
mkdir -p "$DEST_ARG"
DEST="$(cd "$DEST_ARG" && pwd)"

# 安全檢查：不得清空來源，也不得清空來源的上層
if [ "$DEST" = "$SRC" ] || [ "$DEST" = "/" ]; then
  echo "錯誤：目標目錄不可為來源目錄或根目錄。" >&2
  exit 1
fi
case "$SRC/" in
  "$DEST"/*) echo "錯誤：目標目錄包含來源目錄，拒絕清空。" >&2; exit 1 ;;
esac

echo "來源：$SRC"
echo "目標：$DEST"

# ---------------------------------------------------------------------------
# 1. 清空目標
# ---------------------------------------------------------------------------
rm -rf "$DEST"/* 2>/dev/null || true
rm -rf "$DEST"/.[!.]* 2>/dev/null || true

# ---------------------------------------------------------------------------
# 2. 目錄骨架
# ---------------------------------------------------------------------------
mkdir -p \
  "$DEST/.claude" \
  "$DEST/docs/specs/adr" \
  "$DEST/docs/reports" \
  "$DEST/docs/archive" \
  "$DEST/docs/schedule" \
  "$DEST/tasks" \
  "$DEST/worklog/handoff" \
  "$DEST/worklog/daily_summary" \
  "$DEST/scripts" \
  "$DEST/ref" \
  "$DEST/src" \
  "$DEST/tests"

for d in docs/specs/adr docs/reports worklog/handoff worklog/daily_summary ref src tests; do
  : > "$DEST/$d/.gitkeep"
done

# ---------------------------------------------------------------------------
# 3. 原樣複製的框架資產
# ---------------------------------------------------------------------------
cp -r "$SRC/.claude/agents" "$DEST/.claude/agents"
cp -r "$SRC/.claude/skills" "$DEST/.claude/skills"
cp -r "$SRC/docs/templates" "$DEST/docs/templates"
cp "$SRC/scripts/extract-cards.sh"   "$DEST/scripts/extract-cards.sh"
cp "$SRC/scripts/gen-schedule.mjs"   "$DEST/scripts/gen-schedule.mjs"
cp "$SRC/scripts/export-framework.sh" "$DEST/scripts/export-framework.sh"
cp "$SRC/.gitignore" "$DEST/.gitignore"

# ---------------------------------------------------------------------------
# 4. 去專案化：角色檔、技能、模板、腳本、.gitignore
#    規則寫成 sed 腳本檔，再把佔位符換成實際字串（見檔首說明）。
# ---------------------------------------------------------------------------
TMPDIR_EXPORT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_EXPORT"' EXIT
SED_ASSETS="$TMPDIR_EXPORT/assets.sed"

cat > "$SED_ASSETS" <<"SEDEOF"
s@docs/schedule/__EPIC1__.json@docs/schedule/example.json@g
s@\[__EPIC1__\]@[E-###]@g
s@（__EPIC1__ Gate 2 的寫法）@（框架首輪試跑的 Gate 2 寫法）@g
s@ __EPIC1__ @框架首輪試跑@g
s@__EPIC1__ @框架首輪試跑@g
s@__EPIC1__@框架首輪試跑@g
s@__EPIC2__@框架修正 Epic@g
s@# Playwright 執行產物：@# Playwright 執行產物：@
SEDEOF
sed -i -e "s@__EPIC1__@$EPIC1@g" -e "s@__EPIC2__@$EPIC2@g" "$SED_ASSETS"

find "$DEST/.claude" "$DEST/docs/templates" "$DEST/scripts" -type f \
  \( -name "*.md" -o -name "*.mjs" -o -name "*.sh" -o -name "*.yaml" -o -name "*.yml" \) \
  -print0 | xargs -0 sed -i -f "$SED_ASSETS"
sed -i -f "$SED_ASSETS" "$DEST/.gitignore"

# ---------------------------------------------------------------------------
# 5. CLAUDE.md（去專案化）
# ---------------------------------------------------------------------------
SED_CLAUDE="$TMPDIR_EXPORT/claude.sed"
cat > "$SED_CLAUDE" <<"SEDEOF"
s@^- 計畫書：.*$@- 計畫書：`docs/團隊協作計畫書.md`（團隊、文件、流程、模型等級的完整定義；本檔「協作協定」是其摘要）@
/^分四類：/s@不另立新條。@不另立新條。**本範本帶入的鐵則是框架首輪試跑累積的通用經驗；括號內的日期與卡號只是歷史案例來源，不是本專案的事實。新專案沿用並持續補寫。**@
SEDEOF
sed -f "$SED_CLAUDE" "$SRC/CLAUDE.md" > "$DEST/CLAUDE.md"

# ---------------------------------------------------------------------------
# 6. docs/團隊協作計畫書.md（去專案化）
# ---------------------------------------------------------------------------
SED_PLAN="$TMPDIR_EXPORT/plan.sed"
cat > "$SED_PLAN" <<"SEDEOF"
s@^- 版本：v1.1（.*）$@- 版本：v1.1（框架範本；沿革見附錄 B 變更紀錄）@
s@^- 日期：2026-09-19$@- 日期：（採用本範本時填入）@
s@^- 撰寫者：Leader（Claude Fable 5.1）$@- 撰寫者：Leader@
s@^- 狀態：\*\*已核准，Phase 2 修正中\*\*。$@- 狀態：**草案，待使用者確認（使用者介入點 ①）**。@
s@__PROJDIR__-wt/@{專案根目錄}-wt/@g
s@__PROJDIR__/@{專案根目錄}/@g
s@^epic: __EPIC1__$@epic: E-###@
s@（2026-09-19 __EPIC1__：@（歷史案例：@
s@（2026-09-19 __EPIC1__ T-0029：@（歷史案例：@
s@（2026-09-19 __EPIC1__ T-0028／T-0029 同時操作 staging）@（歷史案例：兩張 QA 卡同時對同一個 staging 操作）@
s@（__EPIC1__ 實測：2 小時 12 分零次自動觸發）@（歷史案例實測：2 小時 12 分內零次自動觸發）@
/^\*\*裁決結果（2026-09-19，使用者）\*\*/{N;d}
s@^### Phase 0：框架建置（Leader 自行完成，約 1 個工作階段）$@### Phase 0：框架建置（Leader 自行完成，約 1 個工作階段）\n\n> **本範本已完成 Phase 0 的第 2～7 步**（目錄骨架、模板、12 個角色檔、5 個技能、CLAUDE.md 協定、空看板）。新專案只需做第 1 步 `git init`，即可直接進入 Phase 1。@
s@^| v1.0 | 2026-09-19 | 初版，使用者確認，五項裁決見第 10 章 |@| v1.0 | 2026-09-19 | 初版（框架首版）；第 10 章五項待使用者裁決 |@
s@__EPIC2__ 開卡裁決@框架修正 Epic 開卡裁決（歷史案例）@
s@^v1.1 為同檔進版.*$@v1.1 為同檔進版（沿革見本表與 git log）。**本表的「對應發現」與「依據」欄位記錄的是框架首輪試跑的歷史案例，只說明每一條修正的來源，不是本專案的事實。**@
s@__EPIC1__@歷史案例@g
s@__EPIC2__@歷史案例@g
SEDEOF
sed -i \
  -e "s@__EPIC1__@$EPIC1@g" \
  -e "s@__EPIC2__@$EPIC2@g" \
  -e "s@__PROJDIR__@$PROJDIR@g" \
  "$SED_PLAN"

PLAN_SRC="$(ls "$SRC"/docs/團隊協作計畫書*.md | head -1)"
sed -f "$SED_PLAN" "$PLAN_SRC" > "$DEST/docs/團隊協作計畫書.md"

# ---------------------------------------------------------------------------
# 7. 空看板與登錄檔
# ---------------------------------------------------------------------------
cat > "$DEST/tasks/_todo.md" <<"EOF"
# 待辦看板（tasks/_todo.md）

事實來源是各任務卡 frontmatter；本檔由 Leader 以 `/dispatch` 重新彙整。引言區（本段到第一個 `## ` 之前）只放一行指向當日交接檔。

> （尚無交接紀錄。Leader 每次收工時，在此放一行指向當日交接檔；寫新的一份前，先把上一份整段移入 `worklog/daily_summary/` 的當日日報。）

## 進行中

| 卡號 | 標題 | 角色／模型 | 回合 | 派工時間 | 備註 |
|---|---|---|---|---|---|

## 審核中

| 卡號 | 標題 | 審核者 | 備註 |
|---|---|---|---|

## 阻塞

| 卡號／項目 | 阻塞原因 | 解除條件 |
|---|---|---|
| （無） | | |

## 待辦

| 卡號 | 標題 | 角色／模型 | 依賴 | 備註 |
|---|---|---|---|---|
EOF

cat > "$DEST/tasks/_done.md" <<"EOF"
# 已完成（tasks/_done.md）

由 Leader 於任務卡 `status: done` 時追加一列。事實來源：「派工時間」取該卡第 1 輪交接檔 A 段的開工時間（無交接檔者取任務卡 `created`），「完成時間」取判定 done 時任務卡的 `updated`。時區皆為 +08:00。供工時統計與時間軸使用；逐輪細節見 `worklog/handoff/`。

| 卡號 | 標題 | 角色 | 派工時間 | 完成時間 | 回合 | 審核／備註 |
|---|---|---|---|---|---|---|
EOF

cat > "$DEST/docs/archive/_index.md" <<"EOF"
# 文件封存登錄檔（docs/archive/_index.md）

本目錄僅供歷史查閱，禁止作為引用依據。每封存一份文件登錄一行。

| 封存日期 | 原路徑 | 封存後路徑 | 被誰取代 | 原因 |
|---|---|---|---|---|
EOF

# ---------------------------------------------------------------------------
# 8. 時程表設定檔範例（空 Epic）
# ---------------------------------------------------------------------------
cat > "$DEST/docs/schedule/example.json" <<"EOF"
{
  "epic": "E-000",
  "title": "E-000 專案時程表",
  "tz": "+08:00",
  "epicStatus": "規劃中",
  "artifactUrl": "",
  "output": "docs/專案時程表_{date}.html",
  "phases": [
    { "key": "plan", "label": "規劃階段（規格包，Gate 1）" },
    { "key": "dev-plan", "label": "開發準備（WBS）" },
    { "key": "qa-plan", "label": "測試準備（測試計畫、案例、追溯）" },
    { "key": "dev", "label": "開發" },
    { "key": "qa", "label": "測試（CR / AT / UAT / 總結）" },
    { "key": "dev-fix", "label": "Code Review 修正" },
    { "key": "staging", "label": "staging 部署" },
    { "key": "qa-staging", "label": "staging 補驗（Gate 2 r2）" },
    { "key": "ops", "label": "維運" }
  ],
  "phaseByTeam": { "leader": "plan", "plan": "plan", "dev": "dev", "qa": "qa" },
  "phaseById": {},
  "extraCards": [],
  "gates": [],
  "notes": ""
}
EOF

# ---------------------------------------------------------------------------
# 9. README-框架.md
# ---------------------------------------------------------------------------
cat > "$DEST/README-框架.md" <<"EOF"
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
EOF

# ---------------------------------------------------------------------------
# 10. 摘要
# ---------------------------------------------------------------------------
echo "---"
echo "角色檔：$(ls "$DEST/.claude/agents" | wc -l) 個"
echo "技能：  $(ls "$DEST/.claude/skills" | wc -l) 個"
echo "模板：  $(ls "$DEST/docs/templates" | wc -l) 個"
echo "檔案總數：$(find "$DEST" -type f | wc -l)"
echo "完成：$DEST"
