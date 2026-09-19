---
doc: DEPLOY
title: 部署架構與 CI/CD
epic: E-001
version: 0.2           # T-0010 規格變更（雲端平台改 GCP Cloud Run），變更紀錄見文末
status: frozen         # Gate 1 通過 2026-09-19，變更走「規格變更請求」任務卡
author: plan-sd        # 設計階段由 plan-sd 起草；開發階段由 dev-ops 補實作細節
reviewers: [dev-tl, dev-ops]
updated: 2026-09-19T15:56:00+08:00
---

# 部署架構與 CI/CD：E-001 待辦事項 Web 應用

平台：**Google Cloud Run（Docker 映像，`min instances = 0`）＋ Artifact Registry ＋ Neon Serverless Postgres（Free 方案）**，CI/CD 為 **GitHub Actions**（Epic 指定）。選型理由與被淘汰的選項見 `adr/ADR-0005-雲端平台-CloudRun.md`；認證與同源部署的取捨見 `adr/ADR-0004-認證與同源部署.md`。

> **平台變更說明（T-0010，2026-09-19，使用者裁決）**：本文件原設計於 Render Web Service（Free 方案），已依使用者裁決改為 GCP Cloud Run。舊決策紀錄 `adr/ADR-0003-雲端平台.md` 已標記 `superseded(by ADR-0005)`，僅供歷史查閱、不得作為引用依據。**資料庫維持 Neon Free，ADR-0002 不變；同源部署與 Basic Auth 設計維持 ADR-0004，不變；`Dockerfile` 不變。**

**本文件不含任何憑證值。** Epic 限制明載「憑證與雲端帳號由使用者提供，agent 不得索取或代填」。第 4 章只列環境變數的**名稱與用途**。

---

## 1. 環境清單

| 環境 | 用途 | 網址 | 誰可部署 | 資料 |
|---|---|---|---|---|
| dev | 本機開發與離線驗證 | `http://localhost:8080` | 任何人（`docker compose up`） | 本機 `postgres:16-alpine` 容器，假資料，可任意清空 |
| staging | 驗收者 UAT（UC-010）、測試團隊驗證、NFR 量測 | **待首次部署成功後回填**（T-0027，2026-09-19：`deploy-staging.yml` 已跑兩次真實 run，均在 `auth` 階段失敗，原因是 GCP 端 WIF provider 的 `attribute-condition` 仍是字面佔位符 `assertion.repository == '<owner>/<repo>'`，未替換為實際倉庫 `jsfan910/PJ002`，導致所有 OIDC token 都被拒絕。待使用者修正後重新觸發，網址取得方式不變：格式為 `https://<service>-<hash>-<region-code>.a.run.app`，於該次工作流摘要印出。詳見 `docs/reports/20260919-1551-部署紀錄-E001.md`） | CI 自動（`main` 綠燈後觸發） | Neon Free Postgres，測試資料。P0 無真實個資；P1 導入時一次性 `TRUNCATE`（BR-032） |
| prod | **本 Epic 不建立** | — | — | — |

**為什麼沒有 prod**：Epic 的成功指標只到 Gate 2「staging 可用瀏覽器操作、P0 UAT 全通過」。建立 prod 屬擴大範圍。本文件的 pipeline 保留一個手動觸發的 `deploy-prod` 位置（第 3 章），但**本輪不實作、不設定**。

**首次部署後的回填義務（dev-ops）**：`*.run.app` 網址在服務第一次部署成功前不存在。dev-ops 於骨架卡取得網址後，須回填三處：本表 staging 列、GitHub repository variable `STAGING_BASE_URL`、`04_API規格.yaml` 的 `servers` 區塊 staging 項（該項原為 `https://<service>.onrender.com` 佔位符）。回填前 verify 與監測工作流皆讀 `STAGING_BASE_URL`，不寫死網址。

**本機與 staging 的一致性**：兩者都以**同一份 `Dockerfile`** 建置、都連 PostgreSQL 16。更進一步：Cloud Run 執行的是 **CI 建置並推上 Artifact Registry 的同一個映像**（以 commit SHA 標記），不是「同一份 Dockerfile 在雲端重建」。因此 `docker build` 在本機成功，已經驗掉雲端建置的絕大部分失敗原因，連 base image 漂移的可能性都被消除 —— 這是 Epic「可離線驗證」限制的落實方式。

---

## 2. 雲端資源清單（依 ADR-0005）

GCP 專案與計費帳戶由**使用者**提供。以下每項資源的**建立指令由 dev-ops 寫進 README**（Git Bash 與 PowerShell 兩種寫法，Epic 限制）；本章只定義「要有什麼、規格是什麼、花多少錢」。

| 資源 | 規格 | 用途 | 費用估計 |
|---|---|---|---|
| **Cloud Run service**（名稱建議 `todo-app`） | 區域 `asia-east1`；容器埠 `8080`；記憶體 `512Mi`；CPU `1`（僅請求期間計費）；**`min-instances = 0`**、`max-instances = 2`；並行數 `80`；請求逾時 `60s`；startup probe 指向 `GET /health`；`--allow-unauthenticated`（應用層自行以 Basic Auth 擋整站，ADR-0004） | **單一**對外服務，同時供應單頁前端（`public/`）與 REST API（`/api/v1/*`）。同源部署（Leader 裁決 O-004） | **US$0**。每月免費額度：200 萬次請求、360,000 GB-秒記憶體、180,000 vCPU-秒。本案用量（監測 288–576 次／日＋UAT 手動操作）約為額度的千分之一 |
| **Cloud Run 自動 TLS 憑證＋網址** | `*.run.app` 平台憑證，自動配發與更新；HTTP 請求由 Google 前端 301 導向 HTTPS | AC-010-2、BR-025、NFR-002① —— **由平台滿足，團隊零程式碼** | US$0（含於上） |
| **Artifact Registry repository**（名稱建議 `todo-app`） | 格式 `DOCKER`；區域 `asia-east1`（**與 Cloud Run 同區**，避免跨區流量費）；完整路徑 `asia-east1-docker.pkg.dev/<PROJECT_ID>/todo-app/todo-app`；映像以 **commit SHA** 標記，另推一個 `latest`；**清理政策：保留最近 5 個版本** | 存放 CI 建置的容器映像。Cloud Run 從此處拉映像部署；**回滾依賴舊映像仍在**，故保留數不得少於 3 | **US$0**。每月 0.5 GB 儲存免費；本映像約 150 MB（`node:22-alpine` 多階段），保留 5 版仍在額度內（層共用，實際佔用遠低於 5 × 150 MB） |
| **Neon Serverless Postgres** | Free 方案、PostgreSQL 16、0.5 GB 儲存、閒置自動暫停。**不變（ADR-0002）** | `todos`、（P1）`users` 的持久化。**與運算實例分離**，重新部署與回滾都不觸碰資料（NFR-006、AC-010-3） | **US$0**。免費方案無到期日 |
| **GCP IAM：Workload Identity Federation 一組** | Workload identity pool ＋ OIDC provider（`token.actions.githubusercontent.com`），綁定條件限定本倉庫；一個部署用服務帳號，授三個角色：`roles/run.admin`、`roles/artifactregistry.writer`、`roles/iam.serviceAccountUser` | GitHub Actions 免長期金鑰認證 GCP（第 3 章） | **US$0**。IAM 與 WIF 不計費 |
| **GitHub Actions** | 公開倉庫免費；私有倉庫每月 2000 分鐘免費額度 | CI（lint／unit／build／integration）、部署、定時健康檢查（兼保溫） | US$0（CI 每次約 3–5 分鐘；監測每次約 1 分鐘 × 288 次／日 ≈ 私有倉庫需注意額度，見下） |
| ~~Cloud Scheduler~~ | **不採用** | 定時喚醒的候選方案 | — |

**合計經常性費用：US$0。**

**為什麼不用 Cloud Scheduler 做定時喚醒**（任務卡列為可選項，此處明確否決）：它會多一個 GCP 資源、多一組 IAM 綁定、多一處要在 README 教使用者建立的東西；而 GitHub Actions 的 `schedule` 已經在用（NFR-003 的量測本來就要打 `/health`）、已經免費、且量測結果與保溫行為在**同一個地方觀測**。多一個資源換不到任何東西。若日後 GitHub 排程延遲成為量測品質的瓶頸，再回頭評估。

**`min-instances = 0` 是免費的必要條件，不是效能取捨**：設成 `1` 會讓容器常駐、產生持續的 vCPU 與記憶體計費，直接違反 Epic「免費額度可部署」的硬約束。冷啟 1–3 秒是**刻意承擔、不修**的代價（ADR-0005）。任何人要調高 `min-instances`，視為規格變更，須開規格變更請求任務卡。

**費用護欄（建議使用者一次性設定）**：在計費帳戶上設一個 **US$1 的預算警示**。免費額度是「用量門檻」不是「硬上限」，超過即計費。本案用量離門檻極遠，但護欄的成本只有一次點擊。

**GitHub Actions 額度的注意事項**：若倉庫為**私有**，每 5 分鐘一次的監測工作流會消耗約 288 分鐘／日，一個月即超出 2000 分鐘的免費額度。對策二選一（由 dev-ops 於開卡時擇一，並記錄在該卡）：

1. **倉庫設為公開**（本專案為框架試跑範例，無機密內容 —— 憑證一律在 secrets，不在程式碼中），公開倉庫的 Actions 分鐘數不計費。**建議採此項。**
2. 若必須私有，則把監測改為每 10 分鐘一次，並把 NFR-003 的取樣分母同步調整（**取樣頻率的變更須回報 Leader**，因每 5 分鐘是 Leader 對 O-009 的裁決）。保溫效果不受影響：Cloud Run 沒有 Render Free 那種 15 分鐘休眠門檻，保溫只是把冷啟的命中機率壓低，而冷啟本身只有 1–3 秒。

---

## 3. Pipeline 階段（GitHub Actions）

三個工作流檔案：`ci.yml`（OPS-02）、`deploy-staging.yml`（OPS-03）、`monitor-health.yml`（OPS-04）。

### 3.1 `ci.yml` — PR 與 push to main

| 階段 | 觸發 | 做什麼 | 失敗時 |
|---|---|---|---|
| lint | PR / push main | `npm ci` → `npm run lint`（ESLint ＋ `tsc --noEmit`）→ `npx @redocly/cli lint docs/specs/04_API規格.yaml`。**API 規格一起 lint**，避免規格與實作漂移 | 阻擋合併 |
| unit | PR / push main | `node --test tests/unit/` —— `todo-service` 的 32 條 BR 逐條測試（不需資料庫） | 阻擋合併 |
| build | PR / push main | `docker build -t todo-app:${{ github.sha }} .`。**與 Cloud Run 用同一份 Dockerfile**（`main` 上更是同一個映像），本階段綠燈即代表雲端建置幾乎必然成功 | 阻擋合併 |
| integration | PR / push main | 以 GitHub Actions 的 service container 起 `postgres:16-alpine`，跑 migration 後執行 `node --test tests/integration/`：端點狀態碼、統一錯誤結構、**Basic Auth 三情境（帶對憑證 200／不帶 401／`/health` 無憑證 200）** | 阻擋合併與部署 |

### 3.2 `deploy-staging.yml` — main 綠燈後

| 階段 | 觸發 | 做什麼 | 失敗時 |
|---|---|---|---|
| auth | `ci.yml` 於 `main` 全綠 | `google-github-actions/auth`（WIF，見 3.2.1）取得 GCP 短期憑證 → `google-github-actions/setup-gcloud` → `gcloud auth configure-docker asia-east1-docker.pkg.dev` | **中止部署**；前一版服務維持可用。通知 dev-ops（多半是 WIF 綁定條件寫錯） |
| migrate | auth 成功 | 以 `NEON_DATABASE_URL` 執行 `npm run migrate`（forward-only，單一交易逐檔套用） | **中止部署**，不推映像、不部署；前一版服務維持可用。通知 dev-ops |
| build & push | migrate 成功 | `docker build -t $IMAGE:${{ github.sha }} -t $IMAGE:latest .` → `docker push` 兩個標籤到 Artifact Registry。`$IMAGE` = `asia-east1-docker.pkg.dev/<GCP_PROJECT_ID>/todo-app/todo-app` | **中止部署**。服務仍在舊 revision。通知 dev-ops |
| deploy | push 成功 | `gcloud run deploy todo-app --image "$IMAGE:${{ github.sha }}" --region "$GCP_REGION" --platform managed --allow-unauthenticated --port 8080 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 2 --concurrency 80 --timeout 60s --set-env-vars ... --set-secrets ...`。Cloud Run 端流程：建立新 revision → 啟動容器並通過 startup probe（`GET /health`）→ **才把 100% 流量切到新 revision** → 舊 revision 保留但不接流量（可秒級切回） | **新 revision 啟動失敗時 Cloud Run 不切流量**，舊 revision 繼續服務 100%，服務不中斷。工作流標紅並通知 dev-ops |
| verify | deploy 成功 | 取 `gcloud run services describe todo-app --format="value(status.url)"` 作為基底網址（與 `STAGING_BASE_URL` 比對，不一致即警告）；輪詢 `<base>/health` 直到回 200（每 10 秒一次，**上限 5 分鐘** —— Cloud Run 冷啟只要 1–3 秒，不需要 Render 時代的 10 分鐘）；再以 secrets 中的 Basic Auth 憑證呼叫 `GET /api/v1/todos` 確認回 200（確認認證與資料庫皆正常） | 逾時即工作流失敗並通知 dev-ops；**流量雖已切到新 revision，回滾只需一行 `update-traffic`**（第 5.1 節） |
| deploy-prod | **手動（本輪不實作）** | 保留位置。本 Epic 無 prod 環境 | — |

**為什麼 migrate 在 build & push 之前**：forward-only 的 migration 一律是「加欄位／加表／加索引」，對舊版程式碼是相容的（expand-contract 的 expand 階段）。先 migrate 再部署，可確保新程式碼啟動時 schema 已就緒；即使部署失敗，舊程式碼在新 schema 上仍能運作。

**為什麼映像要同時打 commit SHA 與 `latest` 兩個標籤**：SHA 標籤是**部署與回滾的事實來源**（revision 與映像一一對應，「線上跑的是哪一版」可回推到 commit）；`latest` 只給人手動拉取除錯用，**部署指令一律用 SHA 標籤，不得用 `latest`**——用 `latest` 會讓 revision 指向一個會變動的標籤，回滾就不再是確定性的。

#### 3.2.1 GCP 認證：Workload Identity Federation（主線）

GitHub Actions 以 OIDC token 向 GCP 換取**短期**憑證，**倉庫中不存在任何長期金鑰**。

| 用到的值 | 名稱（GitHub） | 類型 | 說明 |
|---|---|---|---|
| GCP 專案 ID | `GCP_PROJECT_ID` | repository **variable**（非機密） | 例：`my-todo-staging` |
| 部署區域 | `GCP_REGION` | repository **variable**（非機密） | 固定 `asia-east1` |
| Artifact Registry 儲存庫 | `GCP_AR_REPOSITORY` | repository **variable**（非機密） | 固定 `todo-app`；完整映像路徑由工作流組出 |
| Cloud Run 服務名 | `GCP_RUN_SERVICE` | repository **variable**（非機密） | 固定 `todo-app` |
| WIF provider 完整資源名 | `GCP_WIF_PROVIDER` | repository **secret** | 形如 `projects/<專案編號>/locations/global/workloadIdentityPools/<pool>/providers/<provider>`。**非真正機密，但含專案編號，仍置於 secrets 以免誤貼** |
| 部署用服務帳號 email | `GCP_SERVICE_ACCOUNT` | repository **secret** | 形如 `github-deployer@<專案ID>.iam.gserviceaccount.com` |

使用者一次性設定（**約 6 步，指令由 dev-ops 寫進 README**）：建立 workload identity pool → 建立 OIDC provider（issuer `https://token.actions.githubusercontent.com`，**attribute condition 限定為本倉庫**）→ 建立服務帳號 → 以 `roles/iam.workloadIdentityUser` 把該服務帳號綁給「本倉庫的 principalSet」→ 授服務帳號三個角色（`roles/run.admin`、`roles/artifactregistry.writer`、`roles/iam.serviceAccountUser`）→ 把上表六個值填進 GitHub。

**attribute condition 必須限定倉庫**（例如 `assertion.repository == "<owner>/<repo>"`）。少了這一條，**任何 GitHub 倉庫的工作流都能換到你的 GCP 憑證** —— 這是 WIF 設定最常見也最嚴重的錯誤，dev-ops 的 CR 須逐字檢查這一行。

#### 3.2.2 備選：服務帳號 JSON 金鑰

**僅在使用者於 WIF 設定上卡關超過 15 分鐘（NFR-008 的門檻）時啟用。**

- 作法：建立同一個服務帳號的 JSON 金鑰，整份內容放進 repository secret **`GCP_SA_KEY`**；`google-github-actions/auth` 改傳 `credentials_json` 而非 `workload_identity_provider`。其餘階段一字不改。
- **代價（必須明白承擔）**：這是一把**長期有效**的憑證，洩漏即等同交出 Cloud Run 與 Artifact Registry 的寫入權；沒有自動輪替。
- 若採此路徑，dev-ops 須在骨架卡記錄「採備選路徑」與原因，並在該卡列一條待辦：**日後補做 WIF 並刪除金鑰**。
- 兩條路徑**二選一，不並存**。並存等於留了一把沒人在看的鑰匙。

### 3.3 `monitor-health.yml` — NFR-003 的量測與保溫

| 階段 | 觸發 | 做什麼 | 失敗時 |
|---|---|---|---|
| sample | `schedule: cron "*/5 * * * *"` ＋ `workflow_dispatch` | **連續取樣 3 次，間隔 20 秒**，`curl -fsS -o /dev/null -w "%{http_code} %{time_total}" "$STAGING_BASE_URL/health"`（**不帶任何憑證** —— `/health` 是唯一未保護路徑）。結果 append 進 artifact | 記錄失敗次數，**工作流本身不標紅**（單次失敗是資料而非事故），連續 3 次全失敗才以 `::error::` 標記 |

設計說明：

- **為何每次取樣 3 次**：GitHub 的 `schedule` 觸發在尖峰時段可能延遲數分鐘。單次取樣遇到延遲會產生資料空洞；連續 3 次取樣讓單一排程延遲不至於造成整段漏測。NFR-003 的成功率**以實際取樣次數為分母**，不以理論次數（2016 次／7 日）為分母。
- **監測兼保溫**：Cloud Run 在 `min-instances = 0` 下，閒置一段時間後容器會被回收，下次請求需冷啟 **1–3 秒**。定時打 `/health` 讓實例維持存活，把冷啟的命中機率壓低。**但性質與 Render 時代不同**：Render Free 是「15 分鐘無流量即休眠、冷啟 30–50 秒」，保溫是**必要的遮蔽手段**；Cloud Run 沒有固定的休眠門檻，冷啟只有 1–3 秒，保溫是**錦上添花** —— 就算保溫完全失效，使用者撞上的也只是一次 1–3 秒的等待，不是白畫面。
- **頻率**：維持 **每 5 分鐘**（Leader 對 O-009 的裁決：NFR-003 每 5 分鐘取樣一次）。**若因私有倉庫的 Actions 分鐘數而需改為每 10 分鐘**（第 2 章對策 2），保溫效果不受影響，但**取樣分母的變更須回報 Leader**。
- **不帶憑證是刻意的**：若監測帶 Basic Auth 憑證，就等於沒有驗證 BR-017 的豁免是否真的生效。**不帶憑證仍得 200，才證明豁免正確**。

---

## 4. 環境變數清單（只列名稱與用途，值不入版控）

**本章不含任何值。** 使用者於 GCP Secret Manager 或 Cloud Run 服務設定、以及 GitHub repository secrets／variables 中自行填入。`.env.example` 同樣只含名稱與說明。

### 4.1 應用執行期（Cloud Run 服務設定 ／ 本機 `.env`）

非機密項以 `gcloud run deploy --set-env-vars` 帶入（值可進版控，因為它們本來就不是秘密）；機密項**建議**存入 **GCP Secret Manager** 並以 `--set-secrets` 掛載，次選是在 Cloud Run 服務設定中直接填值。**兩種方式都不得把值寫進工作流檔或程式碼。**

| 名稱 | 用途 | 環境 | 來源（secrets 管理） |
|---|---|---|---|
| `NODE_ENV` | `production` / `development`。影響日誌格式與錯誤詳細度 | dev, staging | `--set-env-vars` 明文（非機密） |
| `PORT` | 服務監聽埠。**Cloud Run 會自行注入 `PORT`（預設 8080），應用必須讀它、不得寫死**；本機預設 8080 | dev, staging | Cloud Run 自動注入／本機 `.env` |
| `DATABASE_URL` | **機密**。Neon PostgreSQL 連線字串（含密碼）。本機為 compose 內的 Postgres | dev, staging | Secret Manager（`--set-secrets`）／本機 `.env` |
| `BASIC_AUTH_USER` | **機密**。P0 全站共享帳號（BR-016、Q-008） | staging（本機可選） | Secret Manager（`--set-secrets`） |
| `BASIC_AUTH_PASSWORD` | **機密**。P0 全站共享密碼。**倉庫中不得出現任何值，違反即阻擋級安全缺陷** | staging（本機可選） | Secret Manager（`--set-secrets`） |
| `LOG_LEVEL` | pino 等級（`info` / `debug` / `warn`）。staging 預設 `info` | dev, staging | `--set-env-vars` 明文（非機密） |
| `CORS_ALLOWED_ORIGINS` | 具名的允許來源，逗號分隔。**預設留空 ＝ 同源部署，完全不註冊 CORS 外掛**（Leader 裁決 O-004、BR-015）。**永遠不得填入 `*`** | staging | `--set-env-vars` 明文（預設空字串） |
| `JWT_SECRET` (P1) | **機密**。JWT 簽章金鑰 | staging | Secret Manager（`--set-secrets`） |
| `JWT_EXPIRES_IN` (P1) | access token 有效期，固定 `24h`（BR-021、Q-010）。**無 refresh token** | staging | `--set-env-vars` 明文（非機密） |
| `BCRYPT_COST` (P1) | bcrypt 成本因子，預設 `12`（BR-018 要求 ≥ 10） | staging | `--set-env-vars` 明文（非機密） |

註：若採 Secret Manager，部署用服務帳號需額外授 `roles/secretmanager.secretAccessor`（第 2 章的三個角色之外）。dev-ops 於骨架卡擇定「Secret Manager」或「Cloud Run 服務設定直接填」並記錄在該卡。

### 4.2 CI/CD（GitHub repository secrets ／ variables）

| 名稱 | 用途 | 類型 | 來源 |
|---|---|---|---|
| `GCP_PROJECT_ID` | GCP 專案 ID。組出 Artifact Registry 映像路徑、指定部署目標專案 | **variable**（非機密） | GitHub repository variables |
| `GCP_REGION` | 部署區域，固定 `asia-east1`。Cloud Run 與 Artifact Registry 同區 | **variable**（非機密） | GitHub repository variables |
| `GCP_AR_REPOSITORY` | Artifact Registry 儲存庫名稱（`todo-app`）。與前兩項組出完整映像路徑 | **variable**（非機密） | GitHub repository variables |
| `GCP_RUN_SERVICE` | Cloud Run 服務名稱（`todo-app`）。`gcloud run deploy` 與回滾指令的目標 | **variable**（非機密） | GitHub repository variables |
| `GCP_WIF_PROVIDER` | Workload Identity Federation provider 的完整資源名。GitHub OIDC token 換取 GCP 短期憑證用 | **secret** | GitHub repository secrets |
| `GCP_SERVICE_ACCOUNT` | 部署用服務帳號 email。WIF 換取憑證後要模擬的身分 | **secret** | GitHub repository secrets |
| `GCP_SA_KEY` | **僅備選路徑使用**（3.2.2）。服務帳號 JSON 金鑰全文。採 WIF 時**不應存在** | **secret** | GitHub repository secrets |
| `NEON_DATABASE_URL` | **機密**。CI 的 migrate 階段使用的連線字串（可與應用同一條） | **secret** | GitHub repository secrets |
| `STAGING_BASE_URL` | staging 的基底網址（Cloud Run 的 `*.run.app`）。**首次部署後由 dev-ops 回填**；verify 與監測工作流讀它，不寫死 | **variable**（非機密） | GitHub repository variables |
| `STAGING_BASIC_AUTH_USER` | **機密**。verify 階段呼叫受保護端點用 | **secret** | GitHub repository secrets |
| `STAGING_BASIC_AUTH_PASSWORD` | **機密**。同上 | **secret** | GitHub repository secrets |

**使用者一次性設定清單（交付 README 須逐項列出，兩種 shell 寫法）**：GCP 帳號 → 建立專案 → **啟用計費帳戶（必要，即使費用為 US$0）** → 啟用 API（`run`、`artifactregistry`、`iamcredentials`、`sts`，採 Secret Manager 時另加 `secretmanager`）→ 建立 Artifact Registry repository（`asia-east1`、DOCKER 格式、保留 5 版的清理政策）→ 完成 WIF 六步設定（3.2.1）→ 填 4.1 的機密（Secret Manager 或 Cloud Run 設定）；Neon 帳號 → 建立專案 → 複製連線字串；GitHub → 填入 4.2 的 secrets 與 variables；**首次部署成功後回填 `STAGING_BASE_URL`**。**agent 不索取、不代填。**

**與 Render 時代的差異（使用者須知）**：這條路徑**需要信用卡**（GCP 計費帳戶的硬性前提），但實際費用為 US$0（ADR-0005）。這是使用者裁決時已明確承擔的代價。建議一併設 US$1 預算警示（第 2 章）。

**禁止事項**：`.env` 必須列入 `.gitignore`；任何憑證值不得出現在程式碼、工作流檔、測試 fixture 或文件中；**服務帳號 JSON 金鑰檔絕對不得進版控**；pino 設 `redact: ["req.headers.authorization"]` 確保 Basic Auth 標頭不落日誌。

---

## 5. 回滾程序（必須實際演練過一次，記錄日期與結果）

**前提**：migration 為 **forward-only**（ADR-0002、`05_資料庫設計.md` 第 3 章），且一律為相容變更（加欄位／加表／加索引）。因此**回滾程式碼不需要回滾資料庫** —— 舊版程式碼在新 schema 上仍能運作。這是刻意的設計：免費方案沒有可靠的時間點還原，能回滾的東西反而更容易在慌亂中把資料弄丟。

### 5.1 首選：Cloud Run revision 切流量（目標 < 2 分鐘）

**原理**：每次 `gcloud run deploy` 產生一個**不可變的 revision**，舊 revision 不會被刪除，只是不接流量。回滾＝把流量指回上一個 revision，**不重新建置、不重新拉映像、不重啟資料庫連線以外的任何東西**，數秒內生效。這是本次平台變更（ADR-0005）最實質的收穫：回滾從「人工進 Dashboard 點按」變成**一行可寫進工作流的指令**。

1. 列出 revision，找出最後一次已知良好的那一個（`Active` 欄與部署時間可對照 commit SHA）：

   ```bash
   gcloud run revisions list --service "$GCP_RUN_SERVICE" --region "$GCP_REGION" \
     --format="table(metadata.name, status.conditions[0].lastTransitionTime, spec.containers[0].image)"
   ```

2. 把 100% 流量切回該 revision：

   ```bash
   gcloud run services update-traffic "$GCP_RUN_SERVICE" --region "$GCP_REGION" \
     --to-revisions "<good-revision-name>=100"
   ```

   （無 `gcloud` 時等效路徑：Cloud Console → Cloud Run → 該服務 → **Revisions** 分頁 → **Manage traffic** → 把 100% 指向該 revision。因此 `gcloud` **不是**回滾的必要條件。）

3. 確認流量分佈已生效：

   ```bash
   gcloud run services describe "$GCP_RUN_SERVICE" --region "$GCP_REGION" \
     --format="value(status.traffic)"
   ```

   預期輸出中該 revision 的 `percent` 為 `100`。

4. 驗證（**三條都要做，缺一不可**）：
   - `curl -fsS "$STAGING_BASE_URL/health"` → `200 {"status":"ok"}`
   - `curl -fsS -u "$USER:$PASS" "$STAGING_BASE_URL/api/v1/todos"` → `200`，且**資料筆數與回滾前一致**（驗證 NFR-006：回滾不影響資料）。
   - `curl -sSI "$STAGING_BASE_URL/health" | head -1` 重複 3 次，確認**沒有持續的 5xx**（確認切回的 revision 真的健康，而不是切到另一個壞版本）。
5. 於 `docs/reports/` 或缺陷單記錄：回滾時間、回滾到的 **revision 名稱與 commit SHA**、觸發原因、不可用時長。

**目標時間 < 2 分鐘**：第 2 步本身是秒級操作，時間幾乎全花在第 1 步的判讀與第 4 步的驗證上。**這次真的有餘裕** —— Render 時代的 < 2 分鐘靠的是人手速度，這裡靠的是指令。

**前提：舊映像必須還在**。Artifact Registry 的清理政策保留最近 5 版（第 2 章），**保留數不得少於 3**。若舊映像已被清理，revision 無法啟動，改走 5.2。

### 5.2 備選：以 git 回復並重新部署（目標 < 10 分鐘）

當 revision 切流量不可用（例如舊映像已被清理、或舊 revision 本身也是壞的），或需要把 `main` 的內容一併修正時：

1. `git revert <bad-commit-sha>`（**用 revert 不用 reset**：`main` 受保護且已推送，reset 會改寫他人已拉取的歷史）。
2. 開 PR → CI 四階段全綠 → 由 dev-tl 合併到 `main`。
3. `deploy-staging.yml` 自動觸發；verify 階段輪詢 `/health` 至 200。
4. 同 5.1 第 4 步驗證。

### 5.3 資料庫層（僅在 migration 本身有誤時）

1. **不執行任何 `DROP`／`down` migration。**
2. 撰寫一個**新的**前進式 migration（例如 `003_fix_....sql`）修正錯誤，走 5.2 的流程部署。
3. 僅當資料已遭破壞且無法以前進式修正時，才使用 Neon 的時間點還原（Free 方案的保留窗較短），並於升級單中記錄。此路徑**不納入本設計的可用性保證**。

### 5.4 演練要求

- 演練紀錄：2026-09-19（T-0027 覆核），結果：**尚未實際演練**。回滾指令已寫成可執行腳本（`scripts/rollback-staging.sh`，本機等效；工作流層級指令見本節上方）並以 `bash -n` 語法檢查通過；`gcloud run services update-traffic`／`revisions list`／`services describe` 三條指令逐字對照 5.1 節。**本輪阻擋原因已從「缺憑證」精確化為「GCP 端 WIF provider 的 attribute-condition 仍是字面佔位符，未替換為實際倉庫」**（本機 `gcloud` 已登入並確認：Artifact Registry `todo-app`、Secret Manager 三個 secret 皆已就位且有 enabled 版本，`github-deployer` 服務帳號四個角色與 workloadIdentityUser 綁定皆正確；`gcloud run services list` 回傳空清單，證實**目前沒有任何一個 revision 曾經部署成功過**，回滾演練的前提「至少兩個 revision」尚不成立）。待使用者修正 WIF attribute-condition 並讓 `deploy-staging.yml` 至少成功部署一次後，由 dev-ops 或使用者執行一次 5.1 流程（先部署一個會啟動失敗的版本驗證 startup probe 擋下、再部署一個能啟動但行為有誤的版本執行一次 `update-traffic` 回滾），並回填本行日期與結果。詳見 `docs/reports/20260919-1551-部署紀錄-E001.md`、`worklog/handoff/20260919-1551-T0027-r1-dev-ops.md`。
- **本演練是 Gate 2 的前置條件**，由 **dev-ops** 於 DevOps ② 卡（OPS-03）完成後執行一次 5.1 流程並回填上行。演練內容：刻意部署一個會啟動失敗的版本 → 確認 Cloud Run 因 startup probe（`/health`）不通過而**不把流量切到新 revision**（舊 revision 繼續服務 100%，服務維持可用）→ 再刻意部署一個能啟動但行為有誤的版本，執行一次 5.1 的 `update-traffic` 回滾 → 記錄不可用時間、revision 名稱與資料筆數比對結果。
- **兩種失敗要分開演練**：「啟動失敗」由平台自動擋住（不需回滾），「啟動成功但行為錯誤」才需要 5.1 的回滾。只演練前者等於沒演練回滾。

---

## 6. 監控與告警

### 6.1 監控項目

監控分兩層：**GitHub Actions 定時健康檢查**（外部視角，NFR-003 的正式量測來源，且兼保溫）與 **Cloud Run 內建指標**（平台視角，用於判讀異常的成因）。兩者角色不同，不可互相取代。

| 項目 | 方式 | 門檻 | 對應 |
|---|---|---|---|
| 服務存活（**正式量測**） | `monitor-health.yml` 每 5 分鐘取樣 3 次 `GET /health`（**不帶憑證**）。外部視角，含 DNS 與 TLS | 成功率 ≥ 99% | NFR-003、AC-010-5、UC-011 |
| 部署中斷時長 | 部署期間以每 5 秒一次輪詢記錄連續失敗時長 | < 60 秒 | NFR-003 |
| 回應時間 | 上述 `curl` 的 `%{time_total}` 一併記錄 | 觀察用，正式門檻以 NFR-001 的負載測試為準 | NFR-001 |
| **Cloud Run 請求數／錯誤率** | Cloud Run 內建指標（Console → 該服務 → **Metrics**）：`Request count`（依回應碼分組）、`Request latency`（P50／P95／P99） | 觀察用。與外部取樣對照，可區分「服務掛了」與「網路／DNS 問題」 | NFR-001、NFR-003 |
| **Cloud Run 容器啟動延遲** | 內建指標 `Container startup latency`（即冷啟時間） | 觀察用，預期 **1–3 秒** | NFR-001、SD-04 |
| **Cloud Run 實例數** | 內建指標 `Container instance count` | 觀察用。應在 0–2 之間；**持續 > 0 表示保溫生效，持續為 2 表示接近 `max-instances`** | 第 2 章資源規格 |
| 5xx 事件 | **Cloud Logging** 中 pino 的 `level: 50` 記錄，含 `reqId`（Cloud Run 自動收集 stdout）。查詢：Logs Explorer 過濾 `resource.type="cloud_run_revision"` ＋ `jsonPayload.level=50` | 出現即查 | NFR-005、BR-014 |
| 資料庫容量 | **不監控**。500 筆上限約 125 KB，Neon Free 為 0.5 GB，餘裕約 1000 倍 | — | NFR-007 |
| **雲端費用** | 計費帳戶的 US$1 預算警示（第 2 章） | 出現即查（代表某項用量意外暴衝，或 `min-instances` 被改動） | Epic「免費額度可部署」 |

**不引入 Cloud Monitoring 告警政策**：它要多建通知管道、多一組 IAM，而本案的告警需求只有「服務連續掛掉要有人知道」，`monitor-health.yml` 的 `::error::` ＋ GitHub 寄信已經滿足。Cloud Run 內建指標**只作為判讀依據**，不設自動告警。

### 6.2 採樣期（Leader 裁決 O-009）

- **Gate 2 的門檻：連續 24 小時採樣，每 5 分鐘一次，成功率 ≥ 99%。**
- 連續 7 天為**正式環境的目標**，不作為 Gate 2 的門檻（時程不允許）。
- plan-ba 於 T-0005 把 SRS 的 NFR-003 量測方式改寫為「Gate 2：24 小時；正式：7 天」。

### 6.3 告警與已知誤報

- 告警方式：`monitor-health.yml` 在**連續 3 次取樣全部失敗**時以 `::error::` 標記工作流，GitHub 自動寄信給倉庫關注者。**不引入第三方告警服務、不設 Cloud Monitoring 告警政策**（避免額外帳號與憑證，符合 Epic 限制）。
- **已知誤報來源 —— Cloud Run 的冷啟**（ADR-0005 明確承擔的代價）：
  - `min-instances = 0` 時，閒置一段時間後容器會被回收；下一次請求需冷啟 **1–3 秒**，該次取樣的 `time_total` 會明顯偏高。
  - **與 Render 時代的差異**：冷啟從 30–50 秒降為 1–3 秒，**已不足以讓 `curl` 逾時**，因此冷啟**基本上不再造成取樣失敗**，只會造成回應時間的離群值。這也是 SD-04 的風險等級下降的原因。
  - **判讀規則**：NFR-003 未達標時，**須先區分是應用缺陷還是平台事件**，再決定是否調整設定。判讀依據為 **Cloud Run 內建指標**（`Request count` 依回應碼分組、`Container startup latency`、`Container instance count`）與 **revision 事件紀錄**，以及該時段 GitHub 排程的取樣間隔是否異常拉長。
  - 此判讀規則同步寫入 `03_系統設計書_SD.md` 第 7 章 NFR-003。
- **另一個誤報來源 —— GitHub 排程延遲**：GitHub 的 `schedule` 在尖峰時段可能延遲數分鐘，造成取樣間隔拉長。這是**取樣器的問題，不是服務的問題**，成功率以實際取樣次數為分母即可吸收（第 3.3 節）。
- **NFR-001 的量測不受此誤報影響**：負載測試腳本規定**先暖身 10 秒再開始取樣**，排除冷啟與 Neon 喚醒的離群值（SD 第 7 章 NFR-001）。此規定**保留不動** —— 成本為零，且對 Neon 的冷啟仍有意義。

### 6.4 實作紀錄（T-0018）

- `.github/workflows/monitor-health.yml` 已實作：`cron: "*/5 * * * *"` ＋ `workflow_dispatch`；每次連續取樣 3 次（間隔 20 秒），`curl -fsS -o /dev/null -w "%{http_code} %{time_total}"`，不帶憑證、不附查詢字串（已用 grep 驗證，見 T-0018 交接檔）。
- 取樣結果**寫入兩處**：① 該次執行的 `$GITHUB_STEP_SUMMARY`（表格，人工即時查看）；② `actions/upload-artifact` 上傳 `health-samples-<run_id>` 內含 `health-samples.csv`（`timestamp_utc,attempt,http_code,time_total_seconds`），保留 90 天，供 NFR-003 24 小時／7 天採樣的事後統計（下載各次 run 的 artifact 逐筆彙總即可算成功率）。
- GitHub Actions 額度：**選擇第 2 章對策 1（倉庫設為公開）**——本專案無機密內容，公開倉庫 Actions 分鐘數不計費，取樣頻率維持每 5 分鐘（Leader 對 O-009 裁決不變）。若使用者仍要求私有倉庫，須改為每 10 分鐘並回報 Leader 調整 NFR-003 取樣分母（本卡不預先假設使用者會選私有）。
- **實際 24 小時採樣待使用者提供 GitHub repo 與已部署的 staging 服務後才能開始**（`STAGING_BASE_URL` 為空時，本工作流會印出 `::notice::` 並直接以 0/0 略過，不會誤判為服務掛掉），屬「遠端待驗」清單（交 Leader 追蹤，見 T-0018 交接檔）。

### 6.5 首次真實 run 紀錄（T-0027）

- **`deploy-staging.yml`**：main 於 `7d620f6` 綠燈後自動觸發，共兩次真實 run（`#1` https://github.com/jsfan910/PJ002/actions/runs/35430432261、`#2` https://github.com/jsfan910/PJ002/actions/runs/35430463010），**皆在 `auth`（WIF）階段失敗**，耗時 18～21 秒，錯誤訊息 `google-github-actions/auth failed with: ... {"error":"unauthorized_client","error_description":"The given credential is rejected by the attribute condition."}`。根因與修法見 `docs/reports/20260919-1551-部署紀錄-E001.md`。`migrate`／`build & push`／`deploy`／`verify` 四個階段皆未執行到，因此本輪無法驗證這幾個階段的真實行為，僅靠 T-0018 的本機驗證與 actionlint 佐證其語法正確。
- **`monitor-health.yml`**：main 綠燈後至本卡收尾時（約 15 分鐘內）**尚無任何 run**（GitHub 排程觸發器在工作流剛併入時常有數分鐘至數十分鐘的延遲，非本卡程式碼問題）；`workflow_dispatch` 手動觸發需登入 GitHub，agent 不代登入。**首次成功採樣待 cron 自然觸發或使用者手動按 Run workflow**，屬「遠端待驗」清單（交 Leader 追蹤）。

---

## 7. 三處必須同步的參數表（T-0025，CR S-9，實作紀錄）

Cloud Run 服務參數在三處各寫一份：`infra/cloudrun-service.yaml`（文件化 IaC，第 2 章已註明事實來源為工作流參數）、`.github/workflows/deploy-staging.yml` 的 `gcloud run deploy` 步驟、`scripts/deploy-staging.sh` 的同一段 `gcloud run deploy`。三者本應完全一致；下表逐項對照本卡驗收時的現況，供之後任何一處變更時比對，避免無聲飄移。

| 參數 | `infra/cloudrun-service.yaml` | `deploy-staging.yml` | `scripts/deploy-staging.sh` | 現況 |
|---|---|---|---|---|
| 區域 | 圖片路徑硬編 `asia-east1`（Knative manifest 本身無 region 欄位，套用時由 `--region` 指定） | `--region "${GCP_REGION}"`（repository variable，值為 `asia-east1`） | `--region "${GCP_REGION}"`（使用者 export，值為 `asia-east1`） | 一致 |
| 容器埠 | `containerPort: 8080` | `--port 8080` | `--port 8080` | 一致 |
| CPU | `resources.limits.cpu: "1"` | `--cpu 1` | `--cpu 1` | 一致 |
| 記憶體 | `resources.limits.memory: 512Mi` | `--memory 512Mi` | `--memory 512Mi` | 一致 |
| min-instances | `autoscaling.knative.dev/minScale: "0"` | `--min-instances 0` | `--min-instances 0` | 一致 |
| max-instances | `autoscaling.knative.dev/maxScale: "2"` | `--max-instances 2` | `--max-instances 2` | 一致 |
| 並行數 | `containerConcurrency: 80` | `--concurrency 80` | `--concurrency 80` | 一致 |
| 請求逾時 | `timeoutSeconds: 60` | `--timeout 60s` | `--timeout 60s` | 一致 |
| 非機密環境變數 | `env: NODE_ENV=production, LOG_LEVEL=info, CORS_ALLOWED_ORIGINS=""` | `--set-env-vars "NODE_ENV=production,LOG_LEVEL=info,CORS_ALLOWED_ORIGINS="` | `--set-env-vars "NODE_ENV=production,LOG_LEVEL=info,CORS_ALLOWED_ORIGINS="` | 一致 |
| 機密（Secret Manager 參照） | `secretKeyRef`：`DATABASE_URL←database-url:latest`、`BASIC_AUTH_USER←basic-auth-user:latest`、`BASIC_AUTH_PASSWORD←basic-auth-pass:latest` | `--set-secrets "DATABASE_URL=database-url:latest,BASIC_AUTH_USER=basic-auth-user:latest,BASIC_AUTH_PASSWORD=basic-auth-pass:latest"` | 同左（逐字相同） | 一致 |
| ingress／未驗證存取 | `annotations: run.googleapis.com/ingress: all`（僅控制入口來源，**不等同 IAM 的 `roles/run.invoker` 綁定**） | `--allow-unauthenticated`（gcloud 會同時綁 `allUsers` 的 `roles/run.invoker`） | `--allow-unauthenticated`（同左） | **飄移**：套用 IaC 檔（`gcloud run services replace`）不會自動把服務設為允許未驗證呼叫；日常自動部署走 `deploy-staging.yml`／`deploy-staging.sh` 的 `gcloud run deploy`，皆帶 `--allow-unauthenticated`，故實際服務狀態一致；但若有人改用 `services replace` 手動套用 IaC 檔，需另外執行一次 `gcloud run services add-iam-policy-binding <service> --member=allUsers --role=roles/run.invoker`，否則平台層會擋在應用層 Basic Auth 之前 |
| startup／liveness probe | `startupProbe`（`GET /health`，`initialDelaySeconds: 0`、`periodSeconds: 5`、`timeoutSeconds: 3`、`failureThreshold: 3`）＋ `livenessProbe`（同路徑，`periodSeconds: 30`、`timeoutSeconds: 3`、`failureThreshold: 3`） | 無對應 `gcloud run deploy` flag（`gcloud` 目前不支援以旗標設定自訂 probe；套用 `gcloud run deploy` 時 Cloud Run 使用平台預設探測） | 同左（無對應 flag） | **飄移（已知，ADR-0005 授權 dev-ops 決定去留的取捨之一）**：探測設定**只存在於 IaC 檔**。日常部署路徑（`gcloud run deploy`）目前吃 Cloud Run 平台預設的啟動探測（對容器埠打 TCP 或依映像宣告），並非本檔宣告的 `/health` HTTP 探測。若要讓 `/health` 探測實際生效，須改用 `gcloud run services replace infra/cloudrun-service.yaml`（並先手動代入 `<GCP_PROJECT_ID>`／`<IMAGE_TAG>`）取代 `gcloud run deploy`，或等 `gcloud run deploy` 支援對應旗標後再收斂為單一事實來源。此項為既有已知落差，本卡未變更任何一處部署邏輯，僅在此列表存查 |
| 服務帳號執行身分 | 不宣告（由映像的 `USER appuser` 決定，非 root），本檔亦不重複宣告 | 同左（不由 `gcloud run deploy` 指定容器內執行身分） | 同左 | 一致（皆委由 Dockerfile） |

**維護規則**：日後任何人變更上表任一參數，須同時檢查其餘兩處是否需要跟進；若刻意留下差異（例如 probe 一項），須在本表「現況」欄註明理由與影響範圍，不得無聲飄移。

---

## 變更紀錄

| 日期 | version | 任務卡 | 變更摘要 |
|---|---|---|---|
| 2026-09-19 | 0.1 | T-0004 | 初版。平台為 Render Web Service（Free）＋ Neon Free，Gate 1 通過後凍結 |
| 2026-09-19 | **0.2** | **T-0010**（規格變更請求，使用者裁決、Leader 核准） | **雲端平台改為 GCP Cloud Run（`min-instances = 0`）＋ Artifact Registry**，資料庫維持 Neon Free。改動範圍：第 1 章 staging 網址改為 `*.run.app`（由 dev-ops 部署後填入）；第 2 章資源清單全面改寫（Cloud Run／Artifact Registry／WIF／明確否決 Cloud Scheduler）；第 3 章 pipeline 改為 build → push Artifact Registry → `gcloud run deploy`，新增 3.2.1 WIF 認證與 3.2.2 服務帳號金鑰備選；第 4 章環境變數移除 Render 專屬項、新增 GCP 專屬項；第 5.1 節回滾首選改為 `gcloud run services update-traffic` 切 revision；第 6 章監控加入 Cloud Run 內建指標、冷啟說明由 30–50 秒改為 1–3 秒。決策紀錄見 `adr/ADR-0005-雲端平台-CloudRun.md`（`ADR-0003` 已標 superseded）。**status 維持 `frozen`**，後續變更仍須走規格變更請求任務卡 |
