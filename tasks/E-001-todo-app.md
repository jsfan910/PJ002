---
id: E-001
title: 待辦事項 Web 應用（Phase 1 試跑範例）
status: gate2             # planning | gate1 | developing | testing | gate2 | done
owner: leader
created: 2026-09-19T05:28:50+08:00
updated: 2026-09-19T14:06:43+08:00
---

# E-001 待辦事項 Web 應用

## 目標

以一個小型但完整的產品，走完「規劃 → 開發 → 測試」全流程，驗證本框架的交接文件、回合規則、Gate 報告是否可用。產品本身要能在 staging 上讓終端使用者實際操作。

## 使用者原始需求（Leader 代擬，範例）

- 我想要一個網頁版待辦事項工具：可以新增、編輯、刪除待辦，標記完成／未完成，依狀態篩選，看得到建立時間。
- 有一個簡單的前端頁面就好，不用漂亮，但要能用滑鼠完成所有操作。
- 後端要有 API，將來可能接手機 App。
- 要部署到雲端 staging 讓我可以用瀏覽器打開試。
- 第二優先：多個使用者各自有自己的待辦（要登入）。

## 範圍

- **P0（沒有就不能上）**：待辦 CRUD、完成／未完成切換、依狀態篩選、建立時間顯示、單頁前端、REST API、staging 部署。
- **P1**：多使用者帳號（註冊／登入，JWT），每人只看到自己的待辦。
- **範圍外**：分享／協作、提醒通知、附件、行動 App、i18n。

## 限制

- 技術棧由 plan-sd 決定並寫 ADR；優先選「免費額度可部署、憑證可由使用者自行設定、可離線驗證（本機 docker / IaC plan）」的方案。CI/CD 用 GitHub Actions。
- 開發機為 Windows 11；所有指令須可在 Git Bash 或 PowerShell 執行。
- 憑證與雲端帳號由使用者提供，agent 不得索取或代填。
- 規模刻意小：後端工作項預估 3–5 張卡、前端 1–2 張、DevOps 1–2 張。

## 成功指標

- Gate 1：規格包全部通過 DoD，追溯矩陣孤兒檢查三項為「無」。
- Gate 2：staging 可用瀏覽器操作；P0 使用者故事 UAT 全通過；阻擋級 CR 為 0；README 由 qa-at 實測 15 分鐘內跑起。

## 任務卡

| 卡 | 角色 | 內容 | 依賴 |
|---|---|---|---|
| T-0002 | plan-ba | SRS、澄清紀錄、追溯矩陣初版 | — |
| T-0003 | plan-sa | 系統分析書 | T-0002 |
| T-0004 | plan-sd | SD、API、DB、部署設計、ADR | T-0003 |
| T-0005 | plan-ba | 反向審核 SD 覆蓋度、追溯矩陣定稿 | T-0004 |

## Leader 裁決紀錄

### 2026-09-19T05:38:38+08:00 — 對 T-0002 澄清紀錄 Q-001～Q-011 的裁決

| # | 裁決 | 說明 |
|---|---|---|
| Q-001 | 接受假設 | 標題上限 200 字元，前端即時擋、後端一併驗證 |
| Q-002 | 接受假設 | P0 只有「標題」一個可編輯欄位，不加描述 |
| Q-003 | 接受假設 | 硬刪除、不可復原；UI 二次確認 |
| Q-004 | 接受假設 | 儲存 UTC ISO 8601；前端以瀏覽器本地時區顯示 yyyy-mm-dd HH:mm；不做相對時間 |
| Q-005 | 接受假設 | 建立時間新到舊；使用者不可調整 |
| Q-006 | 接受假設 | 不記錄、不顯示完成時間 |
| Q-007 | 接受假設 | 篩選不保存、不寫網址；預設「全部」 |
| Q-008 | **需要保護，選 HTTP Basic Auth** | 單一共享帳密由使用者放平台 secrets；在應用層或反向代理層擋整站（頁面 + API）；瀏覽器原生提示，前端無額外工作；P1 上線後由 JWT 取代。plan-sd 寫進 SD 第 6 章與部署設計，並寫 ADR |
| Q-009 | 接受假設 | Email 格式不寄驗證信；密碼 ≥ 8 字元 |
| Q-010 | 接受假設 | access token 24 小時，無 refresh token |
| Q-011 | 接受假設 | 導入 P1 時直接清空 staging 既有資料 |
| NFR-001 | 接受 | P95 < 500ms／10 併發 |
| N-001 | 接受 | 登出併入 US-012，不視為擴大範圍 |

處理方式：SRS 正文不需修改（裁決與假設一致；Q-008 的實作選項屬 SD）。01a 澄清紀錄的狀態欄由 plan-ba 於 T-0005 統一更新為「已裁決（Leader，見 Epic 裁決紀錄）」。

### 2026-09-19T05:38:38+08:00 — 流程裁決

- commit 的 Co-Authored-By 署**實際執行該卡的模型**（例：Claude Opus 5），不署 Leader 模型。已寫入 CLAUDE.md 協作協定。

### 2026-09-19T05:57:38+08:00 — 對 T-0002 審核與 T-0003 SA 第 7 章未決事項的裁決

| # | 裁決 | 說明 |
|---|---|---|
| O-005 | **健康檢查端點豁免 Basic Auth** | 端點只回狀態、不回業務資料；BR-017 維持。plan-sd 在 SD 第 6 章與部署設計明列「唯一未保護路徑」 |
| O-009 / NFR-003 | **Gate 2 採 24 小時採樣**（每 5 分鐘一次，成功率 ≥ 99%）；連續 7 天為正式環境目標，不作 Gate 2 門檻 | 時程不允許 7 天。plan-ba 於 T-0005 把 NFR-003 量測方式改寫為「Gate 2：24 小時；正式：7 天」 |
| O-001～O-004、O-006～O-008 | **接受 plan-sa 保守假設為預設** | plan-sd 可在 ADR 說明理由後改採其他做法；未寫 ADR 即視為採預設。特別：O-004 前端與 API 同源；O-007 UUID |
| O-010 | 同前次裁決 | 01a 狀態欄由 plan-ba 於 T-0005 同步 |

### 2026-09-19T07:17:55+08:00 — Gate 1 通過（使用者裁決）

- 使用者回覆「Gate 1 通過，開始開發」。規格 01～06、ADR 凍結；traceability 為 approved（TC 欄待填）。
- 開發階段啟動：T-0008 dev-tl 拆 WBS → Leader 依 WBS 建開發卡 → 分批平行派工。

### 2026-09-19T07:29:49+08:00 — 規格變更（使用者裁決）：雲端平台改 GCP Cloud Run + Neon Free

- 使用者裁決：部署由 Render Free 改為 GCP Cloud Run；資料庫維持 Neon Free（ADR-0002 不變）。
- 理由：冷啟動 1–3 秒優於 30–50 秒；Cloud Run revision 回滾優於 Render；費用維持 0（min instances = 0）。
- 處理：T-0010 規格變更請求（plan-sd）。ADR-0003 標 superseded by ADR-0005；06 部署設計改寫；SD 對應段落同步。dev-ops 骨架卡等 T-0010 done 才開。
- 使用者需準備：GCP 專案 + 計費帳戶、啟用 Cloud Run 與 Artifact Registry API；憑證自行放 GitHub secrets（建議 Workload Identity Federation）。

### 2026-09-19T07:39:07+08:00 — 對 WBS（T-0008）未決事項的裁決

| # | 裁決 | 說明 |
|---|---|---|
| D-01 | **`.env.example` 可含僅限本機 compose 的明顯佔位值**（如 `dev`／`postgres`），staging／prod 值一律只存在平台 secrets | NFR-008「複製即可用」與 06 §4「只含名稱」的衝突以此解；T-0011 憑證掃描排除 `.env.example`，但掃描仍須確認佔位值非真實憑證 |
| D-02 | 接受 | `eslint.config.js` 未列於 SD §8.1 屬目錄樹未窮舉，不走規格變更 |
| D-03 | 接受 | ESM；由 T-0011 決定並寫進 README，前端測試檔 `*.test.mjs` |
| 建卡 | 依 WBS §6 建 T-0011～T-0018，模型依平衡模式（dev-be/fe/ops 用 Sonnet），reviewer dev-tl | T-0011、T-0018 依賴 T-0010 |

### 2026-09-19T07:40:06+08:00 — 對測試計畫（T-0009）7 項的裁決

| # | 裁決 | 說明 |
|---|---|---|
| 1 | **授權補填** traceability NFR 追溯表「對應測試」欄 | 內容依交接檔所列八格；交 T-0019 |
| 2 | **授權改** traceability 主表「狀態」欄為「UC／模組／端點／TC 全欄已定稿」 | 交 T-0019 |
| 3 | NFR-004 改讀為「**最新版即可**」，前一版不要求 | 自動化跑執行當下版本；TC-091 備註與測試計畫 R-5 同步改寫。交 T-0019 |
| 4 | 接受：NFR-008 的 15 分鐘**只計本機**，staging 重現不計時 | TC-095 計時、TC-081 不計時維持 |
| 5 | **開 T-0019 同步 Cloud Run**：測試計畫 6.1、R-4，TC-079／084／089 | 依 T-0010 完成後的 06 與 ADR-0005 改寫；T-0019 depends_on T-0010 |
| 6 | 接受：staging 未就緒的 TC 記「阻擋（環境未就緒）」不記「不通過」 | 使用者提供 GCP 專案與 GitHub repo 後由 T-0018 部署 |
| 7 | 不另開規格變更 | AC-009-5 已於 T-0006 加備註指向特殊驗證表 |

### 2026-09-19T07:43:43+08:00 — 對 T-0010 四項的裁決

| # | 裁決 |
|---|---|
| 1 | 授權 plan-sd 於 T-0010 追加一個修正 commit：SD 第 151、295、330 行 Render 字樣改 Cloud Run |
| 2 | 保溫維持每 5 分鐘（與 NFR-003 監測同頻）；每 10 分鐘僅作私有倉庫節流備案 |
| 3 | 04_API規格.yaml 的 staging servers 佔位符同次修正改為 Cloud Run 形式（https://todo-app-staging-<hash>-<region>.run.app，dev-ops 部署後回填實值） |
| 4 | 不建立 infra/render.yaml；T-0018 outputs 只有 infra/cloudrun-service.yaml |

### 2026-09-19T08:13:18+08:00 — 對 T-0011 三項的裁決

| # | 裁決 |
|---|---|
| ① | Dockerfile 的 `COPY public ./public` 由 T-0014（建立 public/ 的卡）補一行；T-0014 outputs 追加 Dockerfile（僅該行） |
| ② | 本機 Docker daemon 不可用：docker build／compose 兩條驗證延後到 CI（使用者提供 GitHub repo 後）與 T-0018；不阻擋合併。使用者若要本機驗證請啟動 Docker Desktop |
| ③ | 接受 `node --test` glob 寫法；dev-tl 審核 T-0011 時同步修正 WBS §1.1 與 §3.3 文字 |

### 2026-09-19T08:23:28+08:00 — 對 dev-tl 審核 T-0011 提出兩項的裁決

| # | 裁決 |
|---|---|
| ① | README「方式二：本機 Node」補 `.env` 載入步驟（Git Bash `set -a; . ./.env; set +a`；PowerShell 逐行 `$env:` 設定），不改 package.json；交 T-0018（該卡本就擁有 README 部署章節寫入權），並在 T-0018 acceptance 加一條「逐字照 README 方式二可啟動」 |
| ② | D-01 擴及 `ci.yml` 的 CI service container 佔位值（`ci`／`ci`），性質同本機佔位值；憑證掃描改用 dev-tl 交接檔的補強樣式（含可選引號），qa-cr 檢查表採用 |

### 2026-09-19T08:34:45+08:00 — 對 T-0014 一項的裁決

| # | 裁決 |
|---|---|
| ① | T-0017 outputs 追加 `public/index.html`，限新增載入 todo-view.js 的 `<script type="module">` 進入點一行；不重排版面 |

### 2026-09-19T08:39:11+08:00 — 對 T-0013 三項的裁決

| # | 裁決 |
|---|---|
| ① | `tests/unit/todo-repository.test.ts` 併入 T-0013 outputs（dev-tl 審核時視為在範圍內） |
| ② | `package.json` 的 `migrate` 腳本改為 `node dist/db/migrate.js`（或等效需先 build 的寫法）由 dev-tl 於初審合併 commit 一併修正，並在 README 註明 migrate 前需 build；package.json 單一擁有者規約不變（dev-tl 即仲裁者） |
| ③ | 不做啟動時自動 migrate；migrate 為部署 pipeline 的獨立階段（06 §3），由 T-0018 實作 |

### 2026-09-19T08:41:59+08:00 — 對 T-0012 兩項的裁決

| # | 裁決 |
|---|---|
| ① | `.github/workflows/ci.yml` unit job 在 test:unit 前補 `npm run build`，由 dev-tl 於批次 2 合併 commit 一併修（與 T-0013 的 migrate 腳本修法同一 commit） |
| ② | `src/app.ts` 錨點一行 + 必要 import 一行，接受；acceptance 的意圖是「不動其他邏輯」，import 不算 |

### 2026-09-19T09:37:07+08:00 — 對 T-0016 一項的裁決

| # | 裁決 |
|---|---|
| ① | UUID 格式錯誤回 **400 E_VALIDATION**（格式對但無資料才 404），依 04_API規格.yaml 與 SA/SD；Leader 派工提示詞的「404」為誤寫，規格優先。dev-be 依規格實作正確 |

### 2026-09-19T10:20:10+08:00 — 對 T-0018 兩項的裁決

| # | 裁決 |
|---|---|
| ① | 04_API規格.yaml 的 staging servers 佔位符待首次部署成功後，由 Leader 另開小卡（plan-sd 或 dev-ops 回填實值） |
| ② | Secret Manager 命名歸 T-0018，接受 |

使用者一次性設定清單見 README「部署與 secrets（T-0018）」章節；完成前 staging 相關 TC 記「阻擋（環境未就緒）」。

### 2026-09-19T11:45:41+08:00 — 對批次 5 審核三項的裁決；開發階段結案，進入測試

| # | 裁決 |
|---|---|
| ① | `scripts/*.sh` 追認接受：硬前提 6 的意圖是「可在 Git Bash 或 PowerShell 執行」，scripts 只是 workflow 的本機等效，標準指令仍是跨 shell 的 npm script |
| ② | dev-ops 自行補進 outputs 的 `scripts/deploy-staging.sh`、`rollback-staging.sh`、`verify-health.ts` 追認 |
| ③ | 部署階段順序以 06 §3.2 為準（auth → migrate → build&push → deploy → verify）；Leader 派工提示詞寫錯，規格優先 |

開發階段結案：T-0011～T-0018 全部 done 並合併，main `df4071b`；全量 lint 0、unit 75/75、integration 47/47。Epic status → testing。

### 2026-09-19T12:03:12+08:00 — 對 Code Review（T-0020）結果的裁決

- CR 結論退回：阻擋級 2（B-1 豁免比對可被點節段／百分號編碼繞過；B-2 未接啟動時自動 migration）、建議級 11。
- **撤回 Leader 先前裁決 T-0013-③**：凍結規格 05 §3 第 4 條與 SD NFR-008 對策④明文要求「啟動時自動執行 migration」，規格優先；pipeline 的 migrate 階段保留為雙重保險。
- 修正卡（平行）：T-0024 dev-be（B-1、B-2、S-1、S-2）；T-0025 dev-ops（S-3、S-4、S-7、S-9、S-10、S-11）；T-0026 dev-fe（S-5、S-6）。合併後 T-0020 開 r2 只複審修正處。
- ① S-1：關閉 ajv coerceTypes（規格 type: string 嚴格讀）。
- ② S-8：D-01 為權威；不改凍結 SD 文字，改把「D-01 本機佔位值」列入 CR 模板已知例外第 4 類（Leader 更新 docs/templates/code_review_report.md）。
- ③ 追認 T-0016-①（UUID 格式錯回 400）。
- 測試線：T-0021／T-0022 對修正前的 main 執行，結果仍有效；修正合併後由 qa-at 對最終 main 重跑一次（T-0021 r2 或由 T-0023 前補跑）。

### 2026-09-19T12:18:14+08:00 — 對 UAT（T-0022 r1）的裁決

- P0 十則：API 層 7 通過、前端 3 阻擋（qa-uat 主張 api-client 缺 credentials: "include"）。
- 與 dev-tl 審核 T-0017 時在 Chrome 逐 AC 實測 34 條全過（含攔到 PATCH 本文）矛盾；同源 fetch 預設 credentials: same-origin 會帶瀏覽器已持有的 HTTP 認證。**D-FE-001 標「待重現」**，交 qa-lead 於 T-0023 以兩造證據裁定；若確認為工具限制則記「阻擋（工具）」非缺陷。
- 修正卡合併後，qa-uat 以帶帳密網址的瀏覽器工具重跑前端 3 則（T-0022 r2）。
- staging 就緒時間取決於使用者提供 GCP／GitHub 設定；未就緒前維持「本機替代」。

### 2026-09-19T12:22:24+08:00 — 修正卡進度與裁決

- T-0026 review（06b35b8）；T-0024 review（0963818，追加授權 Dockerfile runtime 補 COPY migrations 一行，等待補交）；T-0025 review（4328d36）。
- 裁決：`.github/workflows/ci.yml` lint job 在 `npm run lint` 前補 `npm run build`，由 dev-tl 合併三張修正卡的收尾 commit 一併修。

### 2026-09-19T12:32:40+08:00 — 對自動化測試（T-0021 r1）的裁決

- 結果（修正前 main）：integration 85 過／0 敗／4 阻擋（staging）；e2e Chromium+Edge 136/136；perf NFR-001、NFR-007 PASS；README 方式一 27 秒、方式二 6 秒、0 卡點。
- 裁決：`@playwright/test` 1.63.0 正式列入 devDependencies，dev-tl 合併 T-0021 時安裝並鎖版；Firefox 於非沙盒環境補跑列為 Gate 2 後待辦；TC-080/084/090 需人工部署觸發，待 staging。
- 修正卡（T-0024～T-0026）合併後：dev-tl 合併 T-0021 → qa-at r2 對最終 main 重跑三類測試 → qa-uat r2 重跑前端三則 → qa-cr r2 複審修正處 → qa-lead T-0023。

### 2026-09-19T12:59:14+08:00 — 修正卡合併完成

- T-0024／T-0025／T-0026 皆 done 並合併，main `4b96b20`；全量 lint 0、unit 76/76、integration 56/56、actionlint 0；乾淨環境自動 migration 與 /health 豁免複驗通過。
- dev-tl 裁決 `npm run dev` 拆為 `dev:build`／`dev:run`，Leader 追認。
- D-FE-001 成因說明（dev-tl）：自動化瀏覽器需先以帶帳密網址載入建立認證快取，再以不帶帳密網址操作；供 qa-uat r2 採用、qa-lead T-0023 裁定為「工具限制」參考。
- 下一步：dev-tl 合併 T-0021 分支（Playwright 列入 devDependencies）→ qa-cr r2、qa-at r2、qa-uat r2 平行 → T-0023。

### 2026-09-19T13:12:54+08:00 — T-0021 合併與追認

- T-0021 分支合併（main `e7abe4f`）：Playwright 1.63.0 devDependency、tsconfig.e2e.json、test:integration 收斂為進程內、QA HTTP 組改 test:integration:qa。合併後 e2e Chromium 68/68、QA integration 38 過／4 阻擋、perf PASS、actionlint 0。
- 追認 dev-tl 兩項：①本機 compose 服務因平行 agent 使用而未關閉；②tsconfig.e2e.json 拆分而非把 DOM 塞進 Node 測試設定。
- qa-lead T-0023 驗收須同時跑 test:integration 與 test:integration:qa。
- qa-at r2：對最終 main 重跑三類並更新 AT 報告（r1 報告數字已過時）。

### 2026-09-19T13:15:01+08:00 — 對 CR r2（T-0020）的裁決

- 結論：阻擋級 0；r1 13 項全部已修正；新增建議級 N-1（runMigrations 無互斥鎖，多實例冷啟一方 exit 1）。
- 裁決：N-1 列 P1 待辦（與 002 migration 同卡處理，Cloud Run min instances 0 且 staging 單實例，P0 不受影響）；T-0020 r2 交 qa-lead 於 T-0023 審核。

### 2026-09-19T13:17:08+08:00 — UAT r2（T-0022）結果

- P0 十則 10/10 通過（本機替代環境）；D-FE-001 判定為「阻擋（工具）」非缺陷；staging 就緒後重跑列 Gate 2 後待辦。

### 2026-09-19T14:06:43+08:00 — 對測試總結（T-0023）三項的裁決；Gate 2 報告提交

| # | 裁決 |
|---|---|
| A | Gate 2 判定建議「阻擋（環境未就緒），待使用者完成 staging 一次性設定後補驗」，報告首行載明 0 條不通過、0 開放 S1/S2；最終判定交使用者（Gate 2 報告第 3 章①） |
| B | NFR-004 Firefox 兩組維持原裁決：Gate 2 後於非沙盒環境補跑 |
| C | 追認 unit 層 11 條 TC 以 CR 檢查清單 + 套件全綠佐證；「補 TC-ID 標註」列 P1 |

- T-0020～T-0023 全部 done。Epic status → gate2。Gate 2 報告：docs/reports/20260919-1410-Gate2-E001.md。
- 等待使用者：① Gate 2 判定 ② 是否現在開 P1 ③ staging 一次性設定與 GitHub repo。

### 2026-09-19T15:50:02+08:00 — staging 設定就緒，進入部署補驗

- 使用者：GCP 與 GitHub 一次性設定完成；repo https://github.com/jsfan910/PJ002；GCP 專案 pj002-509106、專案編號 538912330059、區域 asia-east1。
- Leader 加 remote origin 並推送 main（觸發 deploy-staging.yml）。建 T-0027（dev-ops）做首次部署驗證、回填、回滾演練、監測啟動。
- 後續：T-0028（qa-at r3 staging 重跑 + qa-uat r3 staging UAT，24 小時採樣判讀）→ T-0029（qa-lead 測試總結 r2）→ Gate 2 報告 r2。
- 使用者設定過程沉澱的 README 修正（cmd/PowerShell 用 gcloud.cmd、佔位符、<(echo) 改寫檔、secret 用檔案避免換行）納入 T-0027 outputs。

### 2026-09-19T16:30:09+08:00 — staging 首次部署成功；Leader 介入診斷紀錄

- 時間軸：run 35431202802 attempt 1 部署成功但 verify（帶憑證）401；Leader 診斷：Secret Manager 三個 secret 位元組乾淨（9/9/147，無換行；PowerShell 管線 Format-Hex 看不出尾端換行，改用 Git Bash 計數）、Cloud Run env 對應正確、IAM 齊全、部署映像拉回本機同帳密 200 → 判定為 revision 00001 執行實例解析到的 secret 值有誤。Leader 執行 `gcloud run services update --update-secrets` 建 revision 00003 後帶憑證 200；使用者同時 Re-run 的 attempt 2 全綠（verify 含帶憑證通過）。
- dev-ops 先前「basic-auth-user 含 3 個換行」的判斷不成立（以位元組計數證偽）。
- staging 網址：https://todo-app-dpevsdhdva-de.a.run.app（另有 https://todo-app-538912330059.asia-east1.run.app 同服務）。使用者已填 GitHub variable STAGING_BASE_URL。
- 建議（交 dev-ops 寫進 06 第 6 章）：secret 改釘具體版本而非 latest，並在 deploy 後 verify 失敗時自動再建一個 revision 重試一次。
- 安全提醒：使用者曾將 staging 帳密貼入對話，驗收後建議輪換（Secret Manager 加新版 + GitHub secrets 更新 + 重新部署）。
- 注意：Leader 手動 `configure-docker` 曾寫入 docker credHelpers（asia-east1-docker.pkg.dev → gcloud），需 SDK bin 在 PATH 才能運作；不影響 CI。

### 2026-09-19T16:51:26+08:00 — T-0027 done；紀錄更正

- T-0027 done 並合併推送（main b4b9d41）。追認：acceptance 第 5 條（monitor 至少一次採樣）因 GitHub 排程延遲未達成，不阻擋合併，列追蹤項；已請使用者手動觸發 Monitor Health。
- **更正 16:30 那段**：依 gcloud run revisions list，Leader 手動 update-secrets 建的是 revision 00002-sn7（08:28:56Z），CI attempt 2 建的是 00003-lt2（08:29:05Z）；原文寫反，以本段與 06 §6.7 為準。結論不變。
- 三個 revision：00001（首次，verify 401）、00002（Leader）、00003（CI，現 100% 流量；T-0027 合併推送後將再產生 00004）。

### 2026-09-19T16:54:38+08:00 — Monitor Health 失敗、UAT r3 阻擋的處置；看板改表格

- Monitor Health 首次 run 失敗於「連續 3 次全失敗」：疑 STAGING_BASE_URL 含前導空白或結尾斜線（`//health` 不在豁免清單回 401）。已請使用者修正變數並手動重跑。
- T-0029 r1（qa-uat/haiku）報前端 8/10 阻擋；Leader 以內建瀏覽器實測 staging：頁面載入、GET /api/v1/todos?status=all 200、清單渲染正常 → 判為工具操作問題非缺陷。T-0029 進 r2，模型升 sonnet（Leader 裁量：連兩輪誤判工具限制，不等第 3 輪）。
- 使用者要求：tasks/_todo.md 與 _done.md 改表格排版，已完成。

### 2026-09-19T17:07:43+08:00 — NFR-003 採樣起算

- 使用者修正 STAGING_BASE_URL 後手動觸發 Monitor Health 成功。**NFR-003 24 小時採樣起算：2026-09-19T17:07:43+08:00**（以此 run 的 created_at 為準，見 GitHub Actions）。判讀時間：2026-09-20 同時刻後；Gate 2 門檻 288 次採樣成功率 ≥ 99%（允許失敗 ≤ 2 次）。

### 2026-09-19T17:30:10+08:00 — 對 T-0028（AT r3 staging）與 T-0029 r2 的裁決；派 T-0030

- T-0028 review（worktree 分支）：integration:qa 36 過／1 敗／5 skip；e2e 133/136（TC-067、TC-009 間歇性）；perf NFR-001 GET P95 156ms、寫入 P95 ≤ 317ms 皆達標；NFR-007 PASS；TC-084、TC-090 通過（引回滾演練）；NFR-003 採樣中。
- 裁決①：TC-079 實測 Cloud Run HTTP→HTTPS 為 302，規格寫 301。**接受 302 等效**（意圖是強制 HTTPS），SRS/06 文字修正列 P1「規格變更請求」，本輪判通過並註記。
- 裁決②：TC-067／TC-009 間歇性失敗（前端 error-message 出現時序）由 qa-lead 於 T-0030 立 S3 缺陷（不擋 Gate 2），修正列 P1。
- 裁決③：TC-078／081／105 不屬 qa-at 範圍，由 UAT r2（T-0029，10/10）與部署紀錄佐證。
- T-0029 r2（sonnet）10/10 通過；r1（haiku）判為工具問題。qa 並行存取 staging 互相刪資料：之後 staging 測試卡錯開時段。
- 派 dev-tl 合併 T-0028 分支；派 qa-lead T-0030（可直接讀 worktree 內報告）。

### 2026-09-19T17:47:01+08:00 — 對測試總結 r2（T-0030）四項的裁決；監測 cron 未觸發

- T-0030 done。退出準則達成 8／未達 3／不適用 1；P0 TC 100 通過、4 部分、1 阻擋、**0 不通過**；開放 S1/S2 = 0、S3 = 2（D-014、D-017）；部署不可用 0 秒。
- **事實**：monitor-health.yml 的 cron `*/5` 自 16:46 手動觸發後至 17:45（59 分鐘）零次自動執行；GitHub 排程有延遲慣例，但不能把 NFR-003 押在它上面。
- 裁決 A：Gate 2 最終判定等 NFR-003 滿 24 小時；今日不另出 Gate 2 r2 報告，以 T-0030 測試總結 r2 為今日狀態。
- 裁決 B：**開 T-0031（dev-ops 維運卡）**：診斷 GitHub cron；新增 GCP Cloud Monitoring uptime check（免費）每 5 分鐘打 /health 作為 NFR-003 主要資料來源，GitHub cron 降為備援；06 §6 更新判讀來源；採樣起算改以 uptime check 建立時間為準。
- 裁決 C：TC-080 間接證據追認；T-0031 推送 main 觸發部署時由 dev-ops 直接量測一次補證。
- 裁決 D：Firefox 4/6 維持 Gate 2 後補跑。

### 2026-09-19T18:11:54+08:00 — T-0031 review；NFR-003 採樣來源切換

- uptime check `todo-app-health-aMAlP5dfKv0` 建立於 2026-09-19T17:55:07+08:00 → **NFR-003 正式起算改為 17:55:07，判讀時間 2026-09-20T17:55:07 之後**（06 §6.8.3 指令）。GitHub cron 為備援，2 小時 12 分零自動觸發，判為排程啟動延遲，不改 workflow。
- TC-080／TC-090：134 個 /health 樣本全 200，最長連續不可用 0 秒。TC-080 資料層 id 比對需憑證，dev-ops 依安全規則未讀取 Secret Manager，留待有憑證的 qa-at 於明日補驗（非擋關）。
- 派 dev-tl 審核合併 T-0031（推送會觸發一次部署）。

### 2026-09-19T18:18:59+08:00 — T-0031 done；E-001 本日結束狀態

- T-0031 done 並合併推送（main 6b699ed）。uptime check 4 地區採樣中，24h 窗 70 點全 true；cron 仍 0 次自動觸發（備援）；TC-080 部署 0 秒不可用（revision 00008 切換實證）。
- **E-001 待辦（明日）**：2026-09-20T17:55:07 後由 qa-lead 重跑 06 §6.8.3 判讀 NFR-003 → 測試總結 r3（T-0036 之後編號）→ Leader Gate 2 報告 r2 → 使用者最終裁決。TC-080 資料層比對由有憑證的 qa-at 補。staging 帳密輪換於 Gate 2 後。

### 2026-09-20T18:03:00+08:00 — NFR-003 24 小時窗走完；建 T-0037 派工

- 24 小時窗於 2026-09-20T17:55:07+08:00 走完（起算依 2026-09-19T18:11:54 裁決）。建 T-0037（qa-lead／opus）：依 06 §6.8.3 以完整窗判讀 NFR-003、出測試總結 r3、更新 TC-089 狀態。
- TC-080 直接比對：本 session 無 staging 憑證（agent 不索取），不納入 T-0037，維持「部分通過」列殘留風險，於 Gate 2 報告 r2 交使用者裁決是否追認間接證據或於 Gate 2 後補做。
- 下一步：T-0037 review → Leader 審核 → Gate 2 報告 r2 → 使用者最終裁決。

### 2026-09-20T18:18:13+08:00 — T-0037 done；NFR-003 判讀 100%；Gate 2 報告 r2 提交

- T-0037 done（Leader 重跑 06 §6.8.3 同窗判讀：4 頁、6936 點、0 false、1156 輪、100%，與報告一致）。TC-089 通過，退出準則第 6 項達標；第 1 項 101/105 ＝ 96.19%（不通過 0、阻擋 0）。
- qa-lead 裁決事項處置：A（第 1 項判準矛盾）→ 交使用者，Gate 2 報告 r2 §3 ①，建議有條件通過；選項 3（修 07 §4 判準）列 E-002 框架 v1.2 待辦。B（TC-080 定案）→ 交使用者，§3 ②，建議由使用者以憑證補做 15 分鐘直接比對，否則追認間接證據。C（cron 備援名不副實）→ Leader 採選項 1：Gate 2 後開規格變更小卡修 06 §6.1，已列看板「待辦（Gate 2 後）」。
- Leader 自承疏失：09-19 裁決 C 的追認未落到文件，造成 TC-080 有 101/102 兩個版本；本輪以文件為準（101）。
- Gate 2 報告 r2：docs/reports/20260920-1822-Gate2-E001-r2.md。等待使用者裁決 ①Gate 判定 ②TC-080 定案 ③Gate 2 後下一步。

### 2026-09-20T18:35:00+08:00 — 使用者裁決 Gate 2 r2：① A 有條件通過 ② B 追認 TC-080 ③ A 先清待辦再開 P1

- ① **Gate 2（P0）有條件通過**。條件：TC-080 定案（見 ②）、發布前輪換 staging Basic Auth 帳密（使用者於 Secret Manager 加新版本）、Gate 2 後待辦以任務卡追蹤。
- ② **TC-080 追認通過**：以三項互相獨立的間接證據（部署期間 /health 零中斷、Neon 與 Cloud Run 運算分離、回滾只切 revision）及本機 TC-093 判通過；直接比對留 P1 staging 測試輪。已落到 docs/specs/traceability.md（US-010 列：通過 8、部分通過 0）與 docs/specs/20_測試案例.md（TC-080 列附註）。退出準則第 1 項據此為 102/105 ＝ 97.14%。
- ③ **先清 Gate 2 後待辦再開 P1**。建卡：T-0038（dev-fe，D-017 修正）、T-0039（dev-ops，secret 釘版本＋verify 自動重試）、T-0040（plan-sd，規格變更請求：06 cron 定位、secret 版本文字、D-016；依賴 T-0039）、T-0041（qa-at，Firefox 兩組補跑，本機）、T-0042（dev-tl，unit TC-ID 標註＋Release Notes v0.1.0 定版＋CHANGELOG；依賴前三卡）。T-0038／T-0039／T-0041 立即派工。
- 帳密輪換由使用者執行；T-0039 合併後下一次部署會自動釘到最新啟用版本。Epic status 維持 gate2 直到 P1 開卡。

### 2026-09-20T19:08:00+08:00 — T-0039 r1 rework；Leader 裁決不 revert；IAM 授權交使用者

- 事實：T-0039 r1 已合併 main（05c9a1e）並推送，deploy-staging run 35506278351 於 `resolve secret versions` 步驟失敗：CI 服務帳號 github-deployer 只有 secretAccessor（僅 versions.access），缺 `secretmanager.versions.list`（在 roles/secretmanager.viewer）。staging 執行期不受影響（現行 revision 照常服務），只有下一次部署會紅。
- 裁決 A：**不 revert 合併**。理由：執行期未壞；revert 後同分支再合併不會帶回內容；修法是補權限或填版本變數，不是回退程式。代價：在使用者授權前 main 的部署工作流維持紅燈，T-0038 合併延後。
- 裁決 B：T-0039 r2 重派 dev-ops（維持 sonnet；失敗原因是「未以 CI 身分驗證」的流程疏漏，不是工具操作），修：workflow 捕捉 gcloud stderr 輸出可讀 ::error::、README 授權步驟補 roles/secretmanager.viewer、06 §6.9 補記本次失敗、交接檔以 CI 服務帳號實際權限為證據。
- 裁決 C：T-0038 派 dev-tl 審核（Docker 已就緒可補跑 e2e），通過也先不合併，等 T-0039 r2 與使用者授權讓 deploy 恢復綠。
- 交使用者：① 授權方式（gcloud add-iam-policy-binding roles/secretmanager.viewer，或填 SECRET_VERSION_DATABASE_URL／BASIC_AUTH_USER／BASIC_AUTH_PASS 三個 repository variables）；② QA Tests run #17 integration-qa 紅燈 job log 需 admin 權限。

### 2026-09-20T19:25:00+08:00 — T-0041 blocked（環境限制）；Leader 裁決

- 事實：Firefox 兩組於 agent 執行環境 68/68 在 browser.launch 階段失敗（`spawn UNKNOWN`，Windows CreateProcess 層級）；Chromium 對照 4/4 正常、二進位檔已 --force 重下、非 Docker 問題。判工具限制，非產品缺陷。報告 docs/reports/20260920-1901-AT-E001-r4-firefox.md。
- 裁決：T-0041 維持 blocked，交使用者在自己的終端執行報告內單一指令，結果貼回後 qa-lead 更新 TC-091；NFR-004 第 10 項維持 4/6，非擋關。T-0042 解除對 T-0041 的依賴，Release Notes 以「已知限制」記載 Firefox 未驗。

### 2026-09-20T19:30:00+08:00 — T-0038 初審通過待合併；favicon 404 另立 T-0043

- dev-tl 審核 T-0038：D-017 三條斷言本機 5 次全過；acceptance 第 4 條（e2e 全過）條件通過，因 msedge 兩尺寸 TC-009 固定失敗於「console 無 error」，21 筆 404 全為 /favicon.ico，且 main（不含 T-0038）同樣重現 → 與本卡無因果。
- 裁決：採 dev-tl 建議①，建 T-0043（dev-fe）補 public/favicon.ico，不新增路由、仍受 Basic Auth 保護；不放寬 TC-009 斷言。T-0038 維持初審通過，等 deploy 綠後與 T-0043 一併由 dev-tl 合併。D-017 正式關閉仍須 qa-lead 於 staging 重跑 TC-067／TC-009 5 次全過（本機從未重現）。
