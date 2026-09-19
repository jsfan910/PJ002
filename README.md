# todo-app（E-001 待辦事項 Web 應用）

<!-- DoD：新 session 依本文件可在 15 分鐘內把專案跑起來（NFR-008，qa-at 實測驗證並在交接檔記錄實際耗時）。 -->

## 一句話

一個以 Fastify + TypeScript（後端）與原生 HTML/CSS/JS（前端，無框架）打造的待辦事項 Web 應用；本機以 `docker compose` 一行帶起，staging 部署於 GCP Cloud Run（見 `docs/specs/06_部署架構與CICD.md`）。

## 技術決定（本卡決定，後續卡沿用，不再變更）

- **`package.json` 的 `type`：`module`**（ESM）。
- **`tsconfig.json` 的 `module`／`moduleResolution`：`NodeNext`**（配合 ESM，`target: ES2022`）。
- 因此前端測試檔命名為 **`*.test.mjs`**（Leader 裁決 D-03），後端測試檔為 `*.test.ts`（以 Node 內建的 TypeScript 型別剝除直接執行，見下方「已知平台限制」）。
- Node.js：本機開發用 `>=22`（`engines.node`），`Dockerfile`／CI 一律釘選 `node:22-alpine`（ADR-0001）。
- 版本釘選：`fastify@^5`、`@fastify/basic-auth@^6`、`@fastify/static@^10`、`pg@^8`（執行期）；`typescript@~5.6`、`eslint@^10`、`typescript-eslint@^8`（開發期）。實際鎖定版本以 `package-lock.json` 為準；**`package.json`／`package-lock.json` 定案後不再更動**（單一擁有者，新增相依需先向 dev-tl 提出）。

## 快速開始

### 方式一：Docker Compose（推薦，一行帶起 app + PostgreSQL）

**Git Bash**

```bash
cp .env.example .env
docker build -t todo-app:dev .
docker compose up -d
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8080/health   # 200
curl -sS http://localhost:8080/health                                     # {"status":"ok"}
```

**PowerShell**

```powershell
Copy-Item .env.example .env
docker build -t todo-app:dev .
docker compose up -d
Invoke-WebRequest -UseBasicParsing http://localhost:8080/health | Select-Object StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:8080/health).Content
```

### 方式二：本機 Node（不需 Docker；health 端點不查資料庫，可獨立驗證）

**本卡（T-0018）補充**：`src/config.ts` 直接讀 `process.env`，不使用 `dotenv` 套件，
`.env` 檔**不會被 `npm start` 自動載入**——`cp .env.example .env` 只是複製檔案，
仍須把檔內變數逐一帶進目前終端機的環境變數，`npm start` 才能讀到。下列兩種
shell 的載入寫法已各自實測一次（見交接檔驗證方式，含耗時）。

**Git Bash**

```bash
cp .env.example .env
npm ci
npm run build
set -a; . ./.env; set +a        # 把 .env 逐行載入目前 shell 的環境變數
npm start                       # 另開一個終端機視窗執行下一步
curl -sS http://localhost:8080/health
```

**PowerShell**

```powershell
Copy-Item .env.example .env
npm ci
npm run build
# 逐行把 .env（複製自 .env.example）的每一個變數設進目前 PowerShell
# session（沒有 dotenv，需手動設；值請照抄 .env 檔內同名那一行，
# 不要另外鍵入——本檔不重複列出，以免與 .env.example 兩處要同步維護）。
# 注意：改用 [System.IO.File]::ReadAllLines()，不要用 Get-Content .env——
# Windows PowerShell 5.1 的 Get-Content 對「UTF-8 不含 BOM ＋ 含中文註解」
# 的檔案會誤判編碼，把部分行併讀成一行，導致變數讀不到（本卡實測發現，
# 逐字重現：Get-Content .env 只讀到 25 行，ReadAllLines 讀到正確的 30 行）：
[System.IO.File]::ReadAllLines("$PWD\.env") | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
  $name, $value = $_ -split '=', 2
  Set-Item -Path "env:$name" -Value $value
}
npm start                       # 另開一個終端機視窗執行下一步
(Invoke-WebRequest -UseBasicParsing http://localhost:8080/health).Content
```

## 常用指令

| 目的 | 指令 |
|---|---|
| 安裝相依 | `npm ci` |
| 開發模式（自動重啟） | `npm run dev` |
| 建置（`tsc`） | `npm run build` |
| 啟動（讀 `dist/`） | `npm start` |
| Lint（ESLint ＋ `tsc --noEmit`） | `npm run lint` |
| 單元測試（後端 `*.test.ts` ＋ 前端 `*.test.mjs`，需先 `npm run build`） | `npm run build && npm run test:unit` |
| 整合測試（需先 `npm run build`，見下方限制） | `npm run test:integration` |
| Migration（**需先 `npm run build`**，腳本讀 `dist/db/migrate.js`） | `npm run build && npm run migrate` |
| 驗證 `/health`（輪詢至 200 或逾時；可用 `BASE_URL`／`POLL_INTERVAL_SECONDS`／`POLL_TIMEOUT_SECONDS` 覆寫，本機預設 `http://localhost:8080`／2 秒／60 秒） | `npm run verify:health` |
| 本機 Docker 建置 | `docker build -t todo-app:dev .` |
| 本機一行帶起 app＋db | `docker compose up -d` |

### 已知平台限制（本卡驗收時記錄，供後續卡與 CI 參考）

- `node --test <目錄>`（不帶副檔名 glob，例如 `node --test tests/integration/`）在本機 Node v24.15.0／Windows 上會誤把目錄路徑當成 CommonJS 模組解析而失敗（`Error: Cannot find module ...`），與本專案程式碼無關（以一個全新的最小範例目錄即可重現同一錯誤）。因此 `test:unit`／`test:integration` 兩個 script 改用明確的 glob（`"tests/unit/**/*.test.ts"`／`"tests/integration/**/*.test.ts"`），效果等價、可正常遞迴尋找測試檔。`test:unit` 另帶第二個 glob `"tests/unit/**/*.test.mjs"`，使前端測試檔（D-03 裁決：前端測試檔副檔名為 `.test.mjs`）同樣被涵蓋；兩個 glob 皆加引號，Git Bash 與 PowerShell 皆可執行。
- `tests/integration/health.test.ts` 匯入路徑指向 `../../dist/`（編譯後產物）而非 `../../src/`：Node 原生的 TypeScript 型別剝除不會把 `.js` 匯入規格自動對應回同名 `.ts` 檔（這是 TypeScript 5.7 的 `rewriteRelativeImportExtensions` 才有的能力；本專案釘選 `~5.6`，尚無此功能）。因此**跑整合測試前務必先 `npm run build`**（`npm run test:integration` 之前的所有本文件範例皆已按此順序排列）。
- 同一原因，**`npm run migrate` 前也必須先 `npm run build`**：`src/db/migrate.ts` 以 `.js` 規格匯入 `../config.js`，直接執行 `.ts` 會 `ERR_MODULE_NOT_FOUND`。`migrate` 腳本已改為讀 `dist/db/migrate.js`（與 `npm start` 同模式，Leader 裁決 T-0013-②）。部署時的順序固定為 **build → migrate → deploy**（06 §3）。
- 同一原因，`npm run test:unit` 也需先 `npm run build`（部分單元測試檔匯入 `dist/`）；`.github/workflows/ci.yml` 的 `unit` job 已於 `test:unit` 前加一步 `npm run build`（Leader 裁決 T-0012-①）。

## 目錄結構

（對應 `docs/specs/03_系統設計書_SD.md` 第 8 章；以下為 P0 全部八張開發卡 T-0011～T-0018 合併後的現況）

```
.
├── .github/workflows/
│   ├── ci.yml                     # lint → unit → build → integration（不推送）
│   ├── deploy-staging.yml         # CI 於 main 全綠後：auth(WIF) → migrate → build&push → deploy → verify
│   └── monitor-health.yml         # cron */5，連續取樣 3 次 /health（不帶憑證），結果上傳 artifact
├── infra/cloudrun-service.yaml    # Cloud Run 服務宣告（文件化 IaC，機密以 Secret Manager 參照）
├── scripts/
│   ├── verify-health.ts           # npm run verify:health 的實作（輪詢 /health 至 200）
│   ├── deploy-staging.sh          # deploy-staging.yml 的本機等效（Git Bash）
│   └── rollback-staging.sh        # 06 §5.1 回滾程序的本機等效（Git Bash）
├── migrations/001_create_todos.sql
├── src/
│   ├── server.ts                  # 啟動、監聽 $PORT、優雅關機
│   ├── app.ts                     # Fastify 組裝＋五個註冊錨點（順序固定，見檔內註解）
│   ├── config.ts                  # 一次驗證 P0 全部環境變數
│   ├── db/                        # pool.ts、migrate.ts
│   ├── plugins/                   # error-handler.ts、basic-auth.ts、static.ts
│   ├── repositories/todo-repository.ts
│   ├── routes/                    # health.ts、todos.ts
│   ├── schemas/                   # error-schema.ts、todo-schema.ts
│   └── services/todo-service.ts   # 業務規則唯一落點
├── public/
│   ├── index.html                 # 單頁骨架（11 個穩定 data-testid）＋ todo-view.js 進入點
│   ├── styles.css
│   └── assets/                    # api-client.js、todo-store.js、todo-view.js
├── tests/
│   ├── unit/                      # *.test.ts（後端）＋ *.test.mjs（前端）
│   └── integration/               # *.test.ts
├── Dockerfile                     # 多階段，node:22-alpine 非 root，監聽 $PORT
├── docker-compose.yml             # 本機 app + postgres:16-alpine
├── .env.example                   # 只有本機 compose 用的明顯佔位值，無真實憑證
└── README.md
```

## 環境變數

見 `.env.example`（本機佔位值）與 `docs/specs/06_部署架構與CICD.md` 第 4 章（名稱、用途，**不含任何值**）。`DATABASE_URL`／`BASIC_AUTH_USER`／`BASIC_AUTH_PASSWORD` 在 staging 只存在於 GCP Secret Manager 與 GitHub secrets，agent 不索取、不代填。

## 部署與 secrets（T-0018）

staging 部署於 **GCP Cloud Run**（`min-instances = 0`，免費額度）＋ **Artifact Registry**（映像存放）＋ **Neon Serverless Postgres（Free）**；CI/CD 為 **GitHub Actions**，GCP 認證採 **Workload Identity Federation（WIF）**，倉庫中不存在任何長期金鑰。完整設計見 `docs/specs/06_部署架構與CICD.md`（第 2～6 章）與 `docs/specs/adr/ADR-0005-雲端平台-CloudRun.md`。**下列指令中的憑證與雲端帳號一律由使用者自行設定，agent 不索取、不代填。**

### 前置：GCP 一次性設定（使用者自行執行）

1. **建立 GCP 專案並啟用計費帳戶**（Cloud Run／Artifact Registry 的硬性前提，即使實際費用為 US$0；建議額外設一個 US$1 預算警示，06 §2）。

2. **啟用 API**（Git Bash 與 PowerShell 指令相同，皆為 `gcloud`）：

   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
     iamcredentials.googleapis.com sts.googleapis.com secretmanager.googleapis.com \
     --project "<你的 GCP_PROJECT_ID>"
   ```

3. **建立 Artifact Registry repository**（區域與 Cloud Run 同區，保留最近 5 版）：

   ```bash
   gcloud artifacts repositories create todo-app \
     --repository-format=docker --location=asia-east1 \
     --project "<你的 GCP_PROJECT_ID>"
   gcloud artifacts repositories set-cleanup-policies todo-app \
     --location=asia-east1 --project "<你的 GCP_PROJECT_ID>" \
     --policy=<(echo '[{"name":"keep-last-5","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":5}}]')
   ```

4. **Workload Identity Federation（六步，06 §3.2.1；`<PROJECT_ID>`／`<PROJECT_NUMBER>`／`<owner>/<repo>` 換成實際值）**：

   ```bash
   # ① 建立 workload identity pool
   gcloud iam workload-identity-pools create github-pool \
     --project="<PROJECT_ID>" --location="global" --display-name="GitHub Actions Pool"

   # ② 建立 OIDC provider（attribute condition 務必限定本倉庫，這是最容易出錯也最嚴重的一步）
   gcloud iam workload-identity-pools providers create-oidc github-provider \
     --project="<PROJECT_ID>" --location="global" --workload-identity-pool="github-pool" \
     --issuer-uri="https://token.actions.githubusercontent.com" \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
     --attribute-condition="assertion.repository == '<owner>/<repo>'"

   # ③ 建立部署用服務帳號
   gcloud iam service-accounts create github-deployer \
     --project="<PROJECT_ID>" --display-name="GitHub Actions deployer"

   # ④ 把服務帳號綁給「本倉庫的 principalSet」
   gcloud iam service-accounts add-iam-policy-binding \
     "github-deployer@<PROJECT_ID>.iam.gserviceaccount.com" \
     --project="<PROJECT_ID>" --role="roles/iam.workloadIdentityUser" \
     --member="principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/attribute.repository/<owner>/<repo>"

   # ⑤ 授服務帳號三個角色（＋ Secret Manager 存取，見下）
   for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser roles/secretmanager.secretAccessor; do
     gcloud projects add-iam-policy-binding "<PROJECT_ID>" \
       --member="serviceAccount:github-deployer@<PROJECT_ID>.iam.gserviceaccount.com" --role="$role"
   done

   # ⑥ 取得 WIF provider 完整資源名（填進 GitHub secret GCP_WIF_PROVIDER）
   gcloud iam workload-identity-pools providers describe github-provider \
     --project="<PROJECT_ID>" --location="global" --workload-identity-pool="github-pool" \
     --format="value(name)"
   ```

   PowerShell 語法相同（`gcloud` 是同一份執行檔），僅需把上面的 Git Bash `for` 迴圈改成：

   ```powershell
   foreach ($role in "roles/run.admin","roles/artifactregistry.writer","roles/iam.serviceAccountUser","roles/secretmanager.secretAccessor") {
     gcloud projects add-iam-policy-binding "<PROJECT_ID>" `
       --member="serviceAccount:github-deployer@<PROJECT_ID>.iam.gserviceaccount.com" --role=$role
   }
   ```

   **若卡關超過 15 分鐘（NFR-008 門檻）**：改用備選路徑（06 §3.2.2）——建立同一服務帳號的 JSON 金鑰，整份內容放進 GitHub secret `GCP_SA_KEY`，並在部署卡的交接檔記錄「採備選路徑」與待辦「日後補做 WIF 並刪除金鑰」。**兩條路徑二選一，不並存。**

5. **Secret Manager**：建立三個 secret（名稱刻意採小寫連字號，避免與應用程式的環境變數全大寫名稱同形造成憑證掃描誤判），並把值填入（值由使用者自行決定，不由 agent 代填）：

   ```bash
   for name in database-url basic-auth-user basic-auth-pass; do
     gcloud secrets create "$name" --project "<PROJECT_ID>" --replication-policy="automatic"
   done
   # 之後用下列指令新增版本（互動輸入值，不會出現在 shell history 的參數裡）：
   #   gcloud secrets versions add database-url --project "<PROJECT_ID>" --data-file=-
   ```

   `infra/cloudrun-service.yaml` 與 `.github/workflows/deploy-staging.yml` 的 `--set-secrets` 皆以這三個名稱參照（`DATABASE_URL=database-url:latest`、`BASIC_AUTH_USER=basic-auth-user:latest`、`BASIC_AUTH_PASSWORD=basic-auth-pass:latest`）。

6. **Neon**：建立專案、複製連線字串，作為 GitHub secret `NEON_DATABASE_URL`（CI migrate 用）與上面 Secret Manager 的 `database-url`（Cloud Run 執行期用，可與 `NEON_DATABASE_URL` 同一條連線字串）。

### GitHub repository 設定（06 §4.2）

**Settings → Secrets and variables → Actions**，Variables 分頁新增：

| 名稱 | 值 |
|---|---|
| `GCP_PROJECT_ID` | 你的 GCP 專案 ID |
| `GCP_REGION` | `asia-east1` |
| `GCP_AR_REPOSITORY` | `todo-app` |
| `GCP_RUN_SERVICE` | `todo-app` |
| `STAGING_BASE_URL` | 留空；**首次部署成功後**由 dev-ops／使用者回填 Cloud Run 給的 `*.run.app` 網址 |

Secrets 分頁新增：

| 名稱 | 值 |
|---|---|
| `GCP_WIF_PROVIDER` | 上面 WIF 設定第 ⑥ 步取得的完整資源名 |
| `GCP_SERVICE_ACCOUNT` | `github-deployer@<PROJECT_ID>.iam.gserviceaccount.com` |
| `GCP_SA_KEY` | **僅備選路徑使用**，採 WIF 時不建立 |
| `NEON_DATABASE_URL` | Neon 連線字串（CI migrate 用） |
| `STAGING_BASIC_AUTH_USER` | staging 的 Basic Auth 帳號（與 Secret Manager `basic-auth-user` 同值） |
| `STAGING_BASIC_AUTH_PASSWORD` | staging 的 Basic Auth 密碼（與 Secret Manager `basic-auth-pass` 同值） |

**倉庫可見性（06 §2 對策二選一）**：建議設為**公開**（本專案為框架試跑範例，無機密內容，憑證一律在 secrets），公開倉庫的 Actions 分鐘數不計費，`monitor-health.yml` 每 5 分鐘一次不會超額；若必須私有，改為每 10 分鐘一次並回報 Leader（NFR-003 取樣分母需同步調整）。

### 首次部署後（`.github/workflows/deploy-staging.yml` 自動觸發於 `main` 綠燈）

1. 從該次執行的 `GITHUB_STEP_SUMMARY` 或 `gcloud run services describe todo-app --region asia-east1 --format="value(status.url)"` 取得網址。
2. 回填三處：GitHub repository variable `STAGING_BASE_URL`；`docs/specs/06_部署架構與CICD.md` 第 1 章環境清單 staging 列；`docs/specs/04_API規格.yaml` 的 `servers` 區塊 staging 項（該值原為佔位符）。

### 本機等效指令（不需 GitHub Actions，直接重現部署／回滾）

- `scripts/deploy-staging.sh`：與 `deploy-staging.yml` 相同的 migrate → build & push → deploy → verify 順序，需先 `export` 好 `GCP_PROJECT_ID`／`GCP_REGION`／`GCP_AR_REPOSITORY`／`GCP_RUN_SERVICE`／`NEON_DATABASE_URL`／`STAGING_BASIC_AUTH_USER`／`STAGING_BASIC_AUTH_PASSWORD`，並已 `gcloud auth login`。
- `scripts/rollback-staging.sh`：回滾程序（06 §5.1）的本機等效，不帶參數列出 revision 清單，帶一個 revision 名稱參數即執行 `update-traffic` 切流量並驗證。

### 監測

`.github/workflows/monitor-health.yml` 每 5 分鐘連續取樣 3 次 `GET /health`（不帶憑證、不附查詢字串），結果寫入該次執行的 artifact 與摘要，供 NFR-003（Gate 2：連續 24 小時、成功率 ≥ 99%）判讀；連續 3 次全失敗才標記工作流為錯誤。

## 文件地圖

- 規格：`docs/specs/`
- 任務：`tasks/`
- 部署：`docs/specs/06_部署架構與CICD.md`
- ADR：`docs/specs/adr/`
