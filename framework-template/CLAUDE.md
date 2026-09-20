# AGENTS.md

## 語言規則

- 全程使用繁體中文回覆。

## 產出規則

- 所有產出文件，若使用者未指定存放位置，一律放在 `docs/` 目錄。
- 所有產出文件，若沒有特別說明，檔名一律加上當天日期（例如 `需求規格書_20260731.md`）。
- 產出的文件，若只需要保留一份最新的事實，將已被取代之舊版文件放入 `docs/archive/` 文件封存目錄。（登錄檔 `docs/archive/_index.md`）
- 例外：`docs/specs/` 下的規格文件與 `docs/templates/` 下的模板為「唯一最新事實」，檔名**不加日期**，以 frontmatter `version`/`updated` 記錄版本；舊版走封存。

## 文件地圖

- 計畫書：`docs/團隊協作計畫書.md`（團隊、文件、流程、模型等級的完整定義；本檔「協作協定」是其摘要）
- 任務卡：`tasks/`（待辦任務清單 `tasks/_todo.md`，已完成任務清單 `tasks/_done.md`，事實來源為各卡 frontmatter）
- 工作紀錄與交接：`worklog/handoff/yyyymmdd-HHmm-T####-r{n}-{role}.md`（開工寫 A 段、收尾寫 B 段）
- 規格文件：`docs/specs/`（01 SRS、01a 澄清、02 SA、03 SD、04 API、05 DB、06 部署、07 測試計畫、10 WBS、20 測試案例、24 缺陷、adr/、traceability.md）
- 模板：`docs/templates/`（任務卡、交接、升級單、Gate 報告、各規格與報告）
- 報告：`docs/reports/yyyymmdd-HHmm-{主題}.md`（給決策者閱讀，不是事實來源）
- 角色定義：`.claude/agents/{role}.md`；流程技能：`.claude/skills/{dispatch,handoff,review-round,takeover,schedule-report}/`（schedule-report 產出 WBS＋甘特圖時程表）
- 文件封存：`docs/archive/*`（已被取代之舊版文件，登錄檔 `docs/archive/_index.md`）。 **該目錄僅供歷史查閱，禁止作為引用之依據。**

## 協作協定（摘要；完整版見計畫書第 6、7 章）

### 角色與模型（平衡模式）

| 團隊 | 角色 | 模型 |
|---|---|---|
| Leader | leader（主 session） | Fable 5.1 |
| 規劃 | plan-ba / plan-sa / plan-sd | Opus 5 |
| 開發 | dev-tl | Opus 5 |
| 開發 | dev-be / dev-fe / dev-ops | Sonnet 5 |
| 測試 | qa-lead / qa-cr | Opus 5 |
| 測試 | qa-at | Sonnet 5 |
| 測試 | qa-uat | Sonnet 5 |

Haiku 適用範圍：格式檢查與彙整；**不指派給需要操作外部工具（瀏覽器、雲端 CLI、容器）的角色**。

任務卡進入第 3 輪時模型自動升一級（haiku→sonnet→opus→fable）。

### 任務卡狀態機

`todo → in_progress → review → done`；`review → rework`（round +1）→ `in_progress`；任何狀態可 → `blocked`（填 `blocked_reason`）。`round` 達 3 仍未過 → `blocked` + 升級單（`docs/reports/yyyymmdd-HHmm-升級-T####.md`，五段式）。

### 寫入權責

| 路徑 | 可寫入者 |
|---|---|
| `tasks/T-*.md` 的 `status`/`round`/`updated` | 該卡 assignee、reviewer、Leader |
| `tasks/_todo.md`、`tasks/_done.md` | 只有 Leader。兩檔皆為表格；`_done.md` 每列含「派工時間」（該卡第 1 輪交接檔 A 段開工時間）與「完成時間」（判 done 時的 `updated`），供工時統計與時間軸 |
| `docs/specs/*` | 規劃團隊對應角色；Gate 1 後凍結，變更走「規格變更請求」任務卡 |
| `src/*` | 開發團隊，每卡一分支 `task/T-####-slug`，且一律在 git worktree（`<根目錄>-wt/T-####`）內作業；合併只由 dev-tl 在根目錄執行 |
| `worklog/handoff/*` | 每檔只由其產生者寫 |

兩張 `in_progress` 的卡 `outputs` 不得重疊；只有 `depends_on` 全 `done` 的卡可啟動。

### 每個角色的固定程序

- 開工：讀任務卡 → 讀 `inputs` → 建交接檔填 A 段 → 卡 `status: in_progress`。
- 收尾：實際執行驗收指令並貼真實輸出 → 填 B 段（空欄寫「無」）→ 卡 `status: review|blocked` → commit `T-####: 摘要`（Co-Authored-By 署實際執行模型）→ 回報五行（狀態｜產出路徑｜交接檔路徑｜需裁決事項｜下一步）。
- 審核：重跑驗證、逐條判 acceptance、寫審核紀錄表、決定 done / rework / blocked。
- **規格優先於 Leader 提示詞**：派工提示詞與凍結規格（`docs/specs/*`）衝突時，**依規格執行**，並在交接檔「假設與決策」註明衝突點與依據路徑，由 Leader 追認。提示詞只指向任務卡與規格路徑，不重述規格內容。
- **Leader 裁量：失敗原因為工具操作而非能力時，可於第 2 輪升級模型**（不必等第 3 輪），並記錄於該卡「審核紀錄」表。
- 禁止：成員直接對使用者發問；成員寫看板；宣稱完成而無執行輸出；改 `outputs` 以外的檔案。

### 使用者介入點

只有三個：① 計畫書 ② Gate 1 規格包 ③ Gate 2 可運行程式 + 測試報告；外加升級單。其餘團隊內解決。

## 回報規則

- 每次執行完一批工作後，對話裡只講三件事，其餘一律外移成 md 檔。
- **對話裡只寫**（順序固定，缺一不可）：
    1. **結論** —— 簡單條列，一句話，做完了什麼、成或不成。
    2. **重點摘要** —— 只寫「會改變你判斷或下一步」的事。包含：我自己的錯誤、與先前說法相反的事實、範圍或前提的變動。**沒有就寫「無」。**
    3. **需要你裁決的項目** ——
        -  每項固定五段：
        <br>① **核心爭議**（用一句話明確指出「具體卡關點」以及「實質影響」是什麼，先講結論與後果，不用術語。）；
        <br>② **證據觀點**（簡單陳述考量的觀點、規範或證據）；
        <br>③ **選項**（最多 3 個，各寫「做法／代價」）；
        <br>④ **我的建議 ＋ 一句理由**；
        <br>⑤ **推翻成本**（選錯了要付什麼、還能不能回頭）。
        <br>**沒有就寫「無」。**
    4. **完整說明之檔案連結** —— markdown 連結，供閱讀。
- 報告檔位置：一律 `docs/reports/`。命名：`yyyymmdd-HHmm-{主題}.md`，日期在最前面**（時間取實查系統時間）。
- 報告檔是**給決策者閱讀的檢視**，不是事實來源，不得成為機器判準的輸入。

## 收工總結規則

- 當使用者輸入「收工」兩個字時，將當天的工作做一份總結紀錄。
- 以 Markdown 檔形式存放於 `worklog/daily_summary/`。檔名： `yyyymmdd-工作總結.md` ，日期在最前面**（時間取實查系統時間）。
- 一天一個檔案：若當天檔案已存在，則接續補寫於同一檔案，不另建新檔。
- 收工時必須同時做第二件事：把「可重複使用」的經驗沉澱到本檔「工作鐵則」。判準是「下一次還會用到嗎」，已存在的鐵則若被再次驗證，於該條後補一筆日期與案例即可，不另立新條。
- 收工時必須同時做第三件事：把「未完成」的工作交接出去。判準是「換一個人明天早上只讀這一段，能不能開工？」 不能就是還沒交接完。
    - 以 Markdown 檔形式存放於 `worklog/handoff/`。檔名：`yyyymmdd-工作交接.md`，日期在最前面**（時間取實查系統時間）**。
    - 日報側只留一行指路：`本日交接見 worklog/handoff/yyyymmdd-工作交接.md 那一份）` —— **不複寫內容**（複寫即第二份真相）。
    - 與任務卡層級交接檔（`worklog/handoff/yyyymmdd-HHmm-T####-r{n}-{role}.md`）的關係：每日交接是 Leader 的總覽，指向當日各任務卡交接檔；任務卡交接檔是各角色的事實紀錄。兩者並存，不互相複寫。

---

## 工作鐵則

分四類：**環境**（工具與 shell 的坑）／**git**（平行作業的提交紀律）／**流程**（派工與驗收的判準）／**安全**（憑證與機密）。每條後括號內為日期與觸發案例；同一條被再次驗證時於該條後補一筆日期與案例，不另立新條。**本範本帶入的鐵則是框架首輪試跑累積的通用經驗；括號內的日期與卡號只是歷史案例來源，不是本專案的事實。新專案沿用並持續補寫。**

### 環境
- **sed 分隔符避開 `#` 與 `|`**：本 repo 文字大量含 `T-####` 與 Markdown 表格 `|`，用它們當分隔符會把該行截斷或報錯；改用 `~` 或 `@`，或改用 Edit 工具。（2026-09-19，Leader 用 `#` 分隔改 CLAUDE.md 權責表，src 列被截成半行並推送出去，下一個 commit 才修回）
- **同一個 session 內新建或修改的 `.claude/agents/*.md` 不會被載入**：角色定義在 session 啟動時讀取；當場建的定義用 `subagent_type: general-purpose` + 提示詞首行「先讀 .claude/agents/{role}.md 整份視為角色指令」備援，改完角色檔要開新 session 才生效。（2026-09-19，Phase 0 建完 12 個角色檔後 Agent 工具回 not found，整天以備援派工）

- **Bash 指令不得含 ASCII 單引號 `'`**：本環境的 Bash 工具會在含單引號的指令上以「unexpected EOF while looking for matching」失敗（含 heredoc 之外的 `printf '…'`、`$'\t'`）。多檔案、含引號的內容改用 Write 工具寫成腳本再 `bash script.sh`。（2026-09-19，Phase 0 建 agent 定義時連續失敗 3 次後確認）
- **Bash 裡不要呼叫 `python3`／`python`**：本機未安裝 Python，`python3` 會被 Windows 應用程式執行別名接管而無限等待，整條指令卡到逾時。文字處理一律用 sed／awk／grep，或 Write 工具。（2026-09-19，Leader 裁決寫入時卡 120 秒後以 taskkill 終止）
- **寫任何時間戳之前先 `date` 實查，不憑印象推算**：Leader 在連續派工時把時間憑感覺往後估，一小時內寫錯七個時戳（最多超前 26 分鐘），事後只能靠 commit 時間逐一改回；qa-lead 同日也在 traceability 寫了超前 21 分鐘的 `updated`。任務卡 `created`／`updated`、Epic 裁決段標題、交接檔 A／B 段、看板派工時間一律取指令輸出。（2026-09-20，T-0038～T-0045 派工期間；T-0048 traceability）
- **Cloud Monitoring `timeSeries.list` 一律跟著 `nextPageToken` 取完分頁**：單頁預設只回約 1/4 資料，直接 `grep -c` 會嚴重低估取樣數；迴圈時 `pageToken` 一定要真的帶進請求，否則無限重抓第一頁（Leader 第一版驗證腳本漏帶，跑了 262 頁才發現）。（2026-09-20，T-0037 NFR-003 判讀 4 頁 6936 點）
- **agent 沙盒與使用者本機不是同一個執行環境**：沙盒無法啟動 Firefox（Windows CreateProcess `spawn UNKNOWN`），沙盒裝的 Playwright 瀏覽器使用者本機也看不到；需要 staging 憑證的 e2e 由使用者在自己終端跑，指令用 `node node_modules\@playwright\test\cli.js` 直呼（PowerShell 執行原則會擋 `npm.ps1`），帳密以 `Read-Host` 互動輸入、不進指令列、不進對話。（2026-09-20，T-0041 Firefox 沙盒 68/68 失敗，使用者本機 67/68；D-017 重跑）
- **PowerShell 管線會吃掉字串尾端換行，且 `Format-Hex` 看不出來**：把值寫進檔案或注入 secret 時，用 `--data-file`／`--out-file` 這類「檔案進、檔案出」的參數，或改用 Git Bash `wc -c` 計位元組驗證長度，不要用管線接 `Format-Hex` 判斷有沒有換行。另：cmd 不認單引號；文件裡的佔位符要含尖括號以免被整段複製貼上。（2026-09-19，T-0027 staging 部署 verify 401，誤判 secret 含 3 個換行，最後以 Git Bash 位元組計數 9/9/147 證偽）

### git

- **Agent 的 git 只准 append：禁止 `--amend`、`reset`、`rebase`、`checkout -- <file>`**。平行作業時 HEAD 可能已是別人的 commit，amend／reset 會把別人的提交移出分支。commit 訊息打錯就再開一個修正 commit；只 `git add` 自己卡的 outputs，永不 `add -A`。（2026-09-19，T-0006 amend 撞掉平行的 T-0007 commit，Leader 以工作區比對後重提交復原）
- **開發卡（有 branch 的卡）一律在 git worktree 內作業，不在專案根目錄切分支**：`git worktree add "<根目錄>-wt/T-####" -b task/T-####-slug`，所有檔案操作、npm、docker、測試、commit 都在該 worktree 內；根目錄永遠停在 main 供文件卡與 Leader 使用。合併由 dev-tl 在根目錄 `git merge --no-ff task/...`，合併後 `git worktree remove`。（2026-09-19，T-0011 派工時發現根目錄切分支會讓平行文件卡的 commit 落到錯的分支）
- **多行 commit 訊息一律寫進檔案再 `git commit -F <file>`**：Bash 工具是 Git Bash，PowerShell here-string（`@'…'@`）會把 `@` 當成訊息首行；`-m` 多行又受單引號限制。（2026-09-19，T-0016 收尾 commit 首行誤植 `@`，因禁止 amend 以空 commit 更正）

### 流程

- **GitHub Actions 的 `schedule` cron 不可靠，不得作為可用性採樣的唯一來源**：排程可能長時間零次觸發。可用性（NFR）採樣一律以**平台原生 uptime check**（如 GCP Cloud Monitoring，每 5 分鐘打 `/health`）為主要資料來源，CI 排程降為備援；**採樣起算時間以 uptime check 建立時間為準**並記入 Epic 裁決紀錄。（2026-09-19，monitor-health.yml `*/5` 連續 2 小時 12 分零次自動執行，改建 uptime check 後 NFR-003 起算改為 17:55:07）
- **Haiku 不指派給需要操作外部工具的角色**：瀏覽器、雲端 CLI、容器等操作，以及「這次失敗是工具限制還是產品缺陷」的判讀，一律 Sonnet 以上。Haiku 只做格式檢查與彙整。（2026-09-19，qa-uat/haiku 兩輪把自動化瀏覽器的認證快取限制誤判為阻擋級缺陷：T-0022 r1 前端 3 則、T-0029 r1 前端 8/10；換 Sonnet 後各一次 10/10 通過）
- **部署驗證必須讀 `status.traffic` 確認新 revision 拿到 100%，不能只打服務網址；用 `--to-revisions` 釘流量的回滾演練結束後必須 `--to-latest` 還原**：09-19 演練切回舊 revision 後未還原，之後 15 次部署建立的 revision 全部 0% 流量，而 verify 打的是服務網址所以每次全綠，staging 服務舊版超過 28 小時才被發現（D-018）。演練收尾要多做一步「觀察下一次部署是否自動切流量」。（2026-09-20，T-0045 流量釘死事故）
- **涉及 IAM 權限的 pipeline 變更，本機通過不算數，必須以 CI 的服務帳號身分實跑一次**：本機 gcloud 是專案擁有者，CI 用的是權限最小的 WIF 服務帳號；dev-ops 本機測 `secrets versions list` 通過，CI 立刻 PERMISSION_DENIED。（2026-09-20，T-0039 r1 缺 `roles/secretmanager.viewer`）
- **多個 agent 需要動根目錄（合併、推送）時由 Leader 序列化；量測部署時由 Leader 統一推送**：dev-tl 合併到一半、dev-ops 要推空 commit 觸發部署，兩者撞在同一個根目錄；改為 dev-ops 只在 worktree 作業並回報「量測就緒」，Leader 等合併完成後推送一次觸發部署。（2026-09-20，T-0044／T-0045 並行）
- **審核「文件宣稱的雲端資源內容」以 `describe` 讀回為準，不採信敘述**：dev-ops 文件寫告警政策內容「刻意只用英文」，dev-tl 讀回是中文且 `creationRecord.mutateTime == mutationRecord.mutateTime` 證明從未更新，宣稱的動作根本沒發生。（2026-09-20，T-0044 r1 退回）
- **e2e 前置以 API 建資料後，先等畫面出現再做下一步**：`page.goto` 只等 load 事件，不等清單 API 回應；接著立刻用 API 刪除，慢網路下項目從未出現，測試逾時。24 次執行 2 敗、跨兩種引擎，被誤疑為產品競態。（2026-09-20，TC-037，OBS-8）
- **多個 QA agent 平行對同一個 staging 操作時，必須錯開時段或做資料隔離**：只動自己建立的資料，否則會互相刪除造成假失敗；測試計畫須載明環境獨占時段。（2026-09-19，T-0028 與 T-0029 同時對 staging 操作互相刪資料，之後改為錯開時段）

### 安全

- **Secret 以 `latest` 注入時，首個 revision 可能解析到錯的值**：釘具體版本號而非 `latest`；並在部署後 `verify` 失敗時自動再建一個 revision 重試一次，再判失敗。（2026-09-19，T-0027 首次部署 revision 00001 帶憑證 verify 401，secret 位元組經驗證乾淨、IAM 與 env 對應皆正確，以 `gcloud run services update --update-secrets` 重建 revision 後即 200）
- **agent 不讀取、不索取、不寫入任何憑證值**：需要憑證的驗證步驟（例如查資料層比對）留給有權限的角色或使用者執行，並在交接檔註明「因安全規則未執行，留待補驗」。使用者若曾把帳密貼入對話，驗收後提醒輪換。（2026-09-19，T-0031 dev-ops 依此規則未讀 Secret Manager，TC-080 資料層比對留給 qa-at 補驗）
