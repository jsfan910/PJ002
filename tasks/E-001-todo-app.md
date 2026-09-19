---
id: E-001
title: 待辦事項 Web 應用（Phase 1 試跑範例）
status: testing           # planning | gate1 | developing | testing | gate2 | done
owner: leader
created: 2026-09-19T05:28:50+08:00
updated: 2026-09-19T11:45:41+08:00
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
