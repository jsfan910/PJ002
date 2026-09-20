---
doc: DEPLOY
title: 部署架構與 CI/CD
epic: E-001
version: 0.3           # T-0040 規格變更（cron 定位、secret 版本釘定、3xx 導向、IAM 角色補列），變更紀錄見文末
status: frozen         # Gate 1 通過 2026-09-19，變更走「規格變更請求」任務卡
author: plan-sd        # 設計階段由 plan-sd 起草；開發階段由 dev-ops 補實作細節
reviewers: [dev-tl, dev-ops]
updated: 2026-09-20T20:55:08+08:00
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
| staging | 驗收者 UAT（UC-010）、測試團隊驗證、NFR 量測 | **`https://todo-app-dpevsdhdva-de.a.run.app`**（T-0027，2026-09-19 首次部署成功並已完整驗證）。三條驗收全過：`GET /health` 無憑證 200；`GET /` 無憑證 401；`GET /api/v1/todos` 帶憑證 200（`deploy-staging.yml` run `35431202802` re-run attempt 2 全綠，含 verify 帶憑證步驟）。現有 revision `todo-app-00001-tfq`／`00002-sn7`／`00003-lt2`，目前 100% 流量在 `00003-lt2`。過程中首次部署的 revision `00001-tfq` 曾出現 `/api/v1/todos` 帶憑證 401，**成因為該執行實例解析到的 secret 值有誤**（Leader 以 Git Bash 直接計數確認 Secret Manager 三個 secret 皆乾淨，`9`／`9`／`147` bytes；先前「`basic-auth-user` 含換行」的判斷不成立，係跨殼層管線量測所致），Leader 執行 `gcloud run services update --update-secrets` 重新綁定後帶憑證即回 200；細節見 §6.6～§6.7、`README.md`「GCP 指令在哪裡執行」與 `docs/reports/20260919-1551-部署紀錄-E001.md`。GitHub repository variable `STAGING_BASE_URL` 已由使用者回填為此網址 | CI 自動（`main` 綠燈後觸發） | Neon Free Postgres，測試資料。P0 無真實個資；P1 導入時一次性 `TRUNCATE`（BR-032） |
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
| **Cloud Run 自動 TLS 憑證＋網址** | `*.run.app` 平台憑證，自動配發與更新；HTTP 請求由 Google 前端以 **3xx（實測 302 Found）** 導向 HTTPS。**判準為「回 3xx 且 `Location` 為對應的 `https://` 網址」，不寫死單一狀態碼**（T-0040／D-016：原文寫死 301，AT r3 與 qa-lead 各自獨立實測皆為 302；Leader 2026-09-19T17:30:10 裁決①接受 302 等效，規範意圖是強制 HTTPS，團隊零程式碼可改） | AC-010-2、BR-025、NFR-002① —— **由平台滿足，團隊零程式碼** | US$0（含於上） |
| **Artifact Registry repository**（名稱建議 `todo-app`） | 格式 `DOCKER`；區域 `asia-east1`（**與 Cloud Run 同區**，避免跨區流量費）；完整路徑 `asia-east1-docker.pkg.dev/<PROJECT_ID>/todo-app/todo-app`；映像以 **commit SHA** 標記，另推一個 `latest`；**清理政策：保留最近 5 個版本** | 存放 CI 建置的容器映像。Cloud Run 從此處拉映像部署；**回滾依賴舊映像仍在**，故保留數不得少於 3 | **US$0**。每月 0.5 GB 儲存免費；本映像約 150 MB（`node:22-alpine` 多階段），保留 5 版仍在額度內（層共用，實際佔用遠低於 5 × 150 MB） |
| **Neon Serverless Postgres** | Free 方案、PostgreSQL 16、0.5 GB 儲存、閒置自動暫停。**不變（ADR-0002）** | `todos`、（P1）`users` 的持久化。**與運算實例分離**，重新部署與回滾都不觸碰資料（NFR-006、AC-010-3） | **US$0**。免費方案無到期日 |
| **GCP IAM：Workload Identity Federation 一組** | Workload identity pool ＋ OIDC provider（`token.actions.githubusercontent.com`），綁定條件限定本倉庫；一個部署用服務帳號，授**五個角色**（見下方「部署服務帳號角色清單」） | GitHub Actions 免長期金鑰認證 GCP（第 3 章） | **US$0**。IAM 與 WIF 不計費 |
| **GitHub Actions** | 公開倉庫免費；私有倉庫每月 2000 分鐘免費額度 | CI（lint／unit／build／integration）、部署、定時健康檢查（兼保溫） | US$0（CI 每次約 3–5 分鐘；監測每次約 1 分鐘 × 288 次／日 ≈ 私有倉庫需注意額度，見下） |
| ~~Cloud Scheduler~~ | **不採用** | 定時喚醒的候選方案 | — |

**合計經常性費用：US$0。**

### 2.1 部署服務帳號角色清單（`github-deployer@<專案ID>.iam.gserviceaccount.com`）

**五個角色缺一不可，每個角色對應 pipeline 中一個具體的 API 呼叫。**少授任何一個，`deploy-staging.yml` 會在對應階段紅燈（T-0040 補列；第 5 項的實例見 §6.9.1）。

| 角色 | 用途（pipeline 中哪一步需要它） | 少了會怎樣 |
|---|---|---|
| `roles/run.admin` | `gcloud run deploy`、`gcloud run services describe`／`update-traffic`（§3.2 deploy 階段、§5.1 回滾） | 部署與回滾皆失敗 |
| `roles/artifactregistry.writer` | `docker push` 映像到 Artifact Registry（§3.2 build & push 階段） | 推映像失敗，不產生新 revision |
| `roles/iam.serviceAccountUser` | `gcloud run deploy` 需以 Cloud Run 執行期服務帳號的身分部署服務 | deploy 階段因無法「act as」服務帳號而失敗 |
| `roles/secretmanager.secretAccessor` | **Cloud Run 容器啟動時**解析 `--set-secrets` 參照、實際讀取 secret 值（`secretmanager.versions.access`） | 新 revision 無法啟動（讀不到 `DATABASE_URL`／Basic Auth 憑證），startup probe 不通過 |
| `roles/secretmanager.viewer`（**T-0040 新增**） | **CI 的 `resolve secret versions` 步驟**執行 `gcloud secrets versions list` 查出當次要釘定的版本號（§3.2、§4.2）。此權限為 `secretmanager.versions.list`，**只存在於本角色**——`secretAccessor` 的 `includedPermissions` 只有 `resourcemanager.projects.get;resourcemanager.projects.list;secretmanager.versions.access`，能讀值但不能列版本 | `resolve secret versions` 步驟以 exit 1 中止，其後 migrate／build & push／deploy／verify 全數 skipped（**已實際發生：run `35506278351`，根因與實查輸出見 §6.9.1**）。備援路徑：填 `SECRET_VERSION_*` repository variables 直接指定版本號，跳過查詢 |

**授權指令**（使用者於自己的 GCP 專案執行；**agent 不代為執行，屬使用者側的雲端安全設定**）：

```bash
for R in run.admin artifactregistry.writer iam.serviceAccountUser \
         secretmanager.secretAccessor secretmanager.viewer; do
  gcloud projects add-iam-policy-binding "<GCP_PROJECT_ID>" \
    --member="serviceAccount:github-deployer@<GCP_PROJECT_ID>.iam.gserviceaccount.com" \
    --role="roles/${R}"
done
```

**既有專案要補跑一次**：本清單第 5 項於 T-0040 才補進規格，在此之前建立的專案只授了前四個角色，須補跑上述指令（只補 `secretmanager.viewer` 亦可）才會生效。核對指令：

```bash
gcloud projects get-iam-policy "<GCP_PROJECT_ID>" --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:github-deployer@<GCP_PROJECT_ID>.iam.gserviceaccount.com"
```

**為什麼不自訂角色**：五個預定義角色的權限面雖略大於實際所需，但自訂角色要多一份 YAML、多一處要維護、且權限清單會隨 GCP API 演進而失效。本案為 staging、單一專案、無真實個資，取「可維護」而非「最小權限的極致」。**若日後導入 prod，此處應改為自訂角色並重新評估**。

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
| **resolve secret versions**（T-0040 補列） | auth 成功、`configure-docker` 之前 | 對 `database-url`／`basic-auth-user`／`basic-auth-pass` 三個 secret 各執行 `gcloud secrets versions list "<secret>" --filter="state=ENABLED" --sort-by="~createTime" --limit=1 --format="value(name)"`，取得**當次要釘定的具體版本號**；寫入 `$GITHUB_STEP_SUMMARY`（表格：secret／版本）與 step outputs，供 deploy 階段組出 `NAME=secret:N`。可由 repository variables `SECRET_VERSION_DATABASE_URL`／`SECRET_VERSION_BASIC_AUTH_USER`／`SECRET_VERSION_BASIC_AUTH_PASS`（選填，只填版本號）覆寫 | **中止部署**（任一 secret 查不到 `ENABLED` 版本即以 `::error::` 中止，不回退到 `:latest`）。需 `roles/secretmanager.viewer`（§2.1 第 5 項），錯誤訊息含 gcloud 原始訊息與修復指引 |
| migrate | auth 成功 | 以 `NEON_DATABASE_URL` 執行 `npm run migrate`（forward-only，單一交易逐檔套用） | **中止部署**，不推映像、不部署；前一版服務維持可用。通知 dev-ops |
| build & push | migrate 成功 | `docker build -t $IMAGE:${{ github.sha }} -t $IMAGE:latest .` → `docker push` 兩個標籤到 Artifact Registry。`$IMAGE` = `asia-east1-docker.pkg.dev/<GCP_PROJECT_ID>/todo-app/todo-app` | **中止部署**。服務仍在舊 revision。通知 dev-ops |
| deploy ＋ verify（**單一步驟，T-0040 依 T-0039 實作更新**） | push 成功 | ① `gcloud run deploy todo-app --image "$IMAGE:${{ github.sha }}" --region "$GCP_REGION" --platform managed --allow-unauthenticated --port 8080 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 2 --concurrency 80 --timeout 60s --set-env-vars ... --set-secrets "DATABASE_URL=database-url:${DB_VERSION},BASIC_AUTH_USER=basic-auth-user:${USER_VERSION},BASIC_AUTH_PASSWORD=basic-auth-pass:${PASS_VERSION}"`（**版本號來自 resolve 階段，不得用 `:latest`**，理由見下方「為什麼 secret 參照要釘具體版本」）。Cloud Run 端流程：建立新 revision → 啟動容器並通過 startup probe（`GET /health`）→ **才把 100% 流量切到新 revision** → 舊 revision 保留但不接流量（可秒級切回）。② 取 `gcloud run services describe todo-app --format="value(status.url)"` 作為基底網址（與 `STAGING_BASE_URL` 比對，不一致即警告）；③ 輪詢 `<base>/health` 直到回 200（每 10 秒一次，**上限 5 分鐘**）；④ 再以 secrets 中的 Basic Auth 憑證呼叫 `GET /api/v1/todos` 確認回 200。**④ 失敗時自動以相同參數、相同已釘定的版本號重跑一次 ①→②→③→④（上限 1 次，無迴圈）**，吸收一次性的 secret 解析異常（§6.7 建議二，事件見 §6.6／§6.7）；③ 失敗**不觸發**重試，直接中止 | **新 revision 啟動失敗時 Cloud Run 不切流量**，舊 revision 繼續服務 100%，服務不中斷。重試後仍失敗才印 `::error::` 判紅並通知 dev-ops；**流量雖已切到新 revision，回滾只需一行 `update-traffic`**（第 5.1 節）。`$GITHUB_STEP_SUMMARY` 依 `retried`／`retry_result` 兩個 output 區分「重試後通過」與「重試後仍失敗」 |
| deploy-prod | **手動（本輪不實作）** | 保留位置。本 Epic 無 prod 環境 | — |

**為什麼 migrate 在 build & push 之前**：forward-only 的 migration 一律是「加欄位／加表／加索引」，對舊版程式碼是相容的（expand-contract 的 expand 階段）。先 migrate 再部署，可確保新程式碼啟動時 schema 已就緒；即使部署失敗，舊程式碼在新 schema 上仍能運作。

**為什麼映像要同時打 commit SHA 與 `latest` 兩個標籤**：SHA 標籤是**部署與回滾的事實來源**（revision 與映像一一對應，「線上跑的是哪一版」可回推到 commit）；`latest` 只給人手動拉取除錯用，**部署指令一律用 SHA 標籤，不得用 `latest`**——用 `latest` 會讓 revision 指向一個會變動的標籤，回滾就不再是確定性的。

**為什麼 secret 參照要釘具體版本（T-0040 規格變更，落實 §6.7 建議一）**：與映像標籤同一個道理。`--set-secrets NAME=secret:latest` 是在**容器啟動當下**才解析的，同一個 revision 定義在不同時間拉起，可能讀到不同的值；「哪個 revision 讀到哪個版本」不透明，出事時無法回溯比對——§6.6／§6.7 的 verify 401 事件就是在這個不透明之下耗掉大半天。改為 `NAME=secret:N` 後：① revision 定義中即記載了確切版本號，**稽核與回滾都是確定性的**；② 版本號一併寫進 `$GITHUB_STEP_SUMMARY`，不必事後查 GCP 也能知道那次部署用了什麼。**代價（明白承擔）**：使用者新增 secret 版本後，**不會**自動被既有 revision 採用，必須重新部署一次（原本用 `:latest` 也一樣要重新部署才生效，故此代價其實只是「多一次 list 呼叫」與「多一個 IAM 角色」，見 §2.1 第 5 項）。**緊急略過路徑**：若 IAM 一時無法調整，填 `SECRET_VERSION_*` repository variables 直接指定版本號即可跳過 list 查詢；此時釘定的是人填的版本號，仍非 `:latest`。

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

使用者一次性設定（**約 6 步，指令由 dev-ops 寫進 README**）：建立 workload identity pool → 建立 OIDC provider（issuer `https://token.actions.githubusercontent.com`，**attribute condition 限定為本倉庫**）→ 建立服務帳號 → 以 `roles/iam.workloadIdentityUser` 把該服務帳號綁給「本倉庫的 principalSet」→ **授服務帳號 §2.1 表列的五個角色**（`roles/run.admin`、`roles/artifactregistry.writer`、`roles/iam.serviceAccountUser`、`roles/secretmanager.secretAccessor`、`roles/secretmanager.viewer`）→ 把上表六個值填進 GitHub。

> **角色數由三改五（T-0040）**：原文只列前三個。`secretmanager.secretAccessor`（容器啟動讀 secret 值）原被放在 §4.1 的註腳、`secretmanager.viewer`（CI 列 secret 版本）則在 §6.9.1 的真實紅燈事件後才確認必要。**五個角色的完整清單與各自用途現以 §2.1 為單一事實來源**，本節與 §4.1 只做指向。

**attribute condition 必須限定倉庫**（例如 `assertion.repository == "<owner>/<repo>"`）。少了這一條，**任何 GitHub 倉庫的工作流都能換到你的 GCP 憑證** —— 這是 WIF 設定最常見也最嚴重的錯誤，dev-ops 的 CR 須逐字檢查這一行。

#### 3.2.2 備選：服務帳號 JSON 金鑰

**僅在使用者於 WIF 設定上卡關超過 15 分鐘（NFR-008 的門檻）時啟用。**

- 作法：建立同一個服務帳號的 JSON 金鑰，整份內容放進 repository secret **`GCP_SA_KEY`**；`google-github-actions/auth` 改傳 `credentials_json` 而非 `workload_identity_provider`。其餘階段一字不改。
- **代價（必須明白承擔）**：這是一把**長期有效**的憑證，洩漏即等同交出 Cloud Run 與 Artifact Registry 的寫入權；沒有自動輪替。
- 若採此路徑，dev-ops 須在骨架卡記錄「採備選路徑」與原因，並在該卡列一條待辦：**日後補做 WIF 並刪除金鑰**。
- 兩條路徑**二選一，不並存**。並存等於留了一把沒人在看的鑰匙。

### 3.3 `monitor-health.yml` — 保溫與人工抽查（**不是** NFR-003 的量測來源，也**不是**備援來源）

| 階段 | 觸發 | 做什麼 | 失敗時 |
|---|---|---|---|
| sample | `schedule: cron "*/5 * * * *"` ＋ `workflow_dispatch`（**實際可依賴的是後者**） | **連續取樣 3 次，間隔 20 秒**，`curl -fsS -o /dev/null -w "%{http_code} %{time_total}" "$STAGING_BASE_URL/health"`（**不帶任何憑證** —— `/health` 是唯一未保護路徑）。結果 append 進 artifact | 記錄失敗次數，**工作流本身不標紅**（單次失敗是資料而非事故），連續 3 次全失敗才以 `::error::` 標記 |

**定位（T-0040 規格變更，落實 Leader 2026-09-20T18:18:13 對裁決事項 C 的選項 1）**：本工作流的用途是 **① 保溫（降低冷啟命中率）與 ② 人工抽查（`workflow_dispatch` 手動觸發，用來快速確認「現在服務還活著嗎」）**。**它不具備援能力，不得被當成 NFR-003 的替代量測來源。**

**為什麼改口**（原文寫「NFR-003 的量測與保溫」、§6.1 原寫「備援來源」）：

- T-0031（2026-09-19）實測：workflow 註冊後 **2 小時 12 分內 `event=schedule` 觸發 0 次**，理論應約 26 次（§6.8.1 完整診斷，已逐項排除分支、路徑、cron 語法、repo 活動四類設定錯誤）。
- T-0037（2026-09-20）在完整 24 小時窗內複測：`event=schedule` 的 run **實際 8 次，理論約 258 次，達成率約 3%**；這 8 次的 `conclusion` 全部 `success`。**即：它會跑，只是幾乎不跑。**不是壞掉，是頻率完全不可信。
- 一個「3% 機率會在你需要時存在」的東西，寫成「備援」比沒有備援更危險——**因為沒有人會再去補一個真的備援**。故本次把文字改到與事實一致。
- 成因判斷為 GitHub 平台對排程的啟動與尖峰延遲，**團隊不可控、無可修的設定缺陷**（§6.8.1）。CLAUDE.md 工作鐵則已沉澱同一結論，本輪為其第二次驗證。

設計說明：

- **保溫仍然有效，且不受 cron 不可靠影響到嚴重程度**：Cloud Run 在 `min-instances = 0` 下，閒置一段時間後容器會被回收，下次請求需冷啟 **1–3 秒**。定時打 `/health` 把冷啟命中機率壓低。**但性質與 Render 時代不同**：Render Free 是「15 分鐘無流量即休眠、冷啟 30–50 秒」，保溫是**必要的遮蔽手段**；Cloud Run 沒有固定的休眠門檻，冷啟只有 1–3 秒，保溫是**錦上添花** —— 就算保溫完全失效（cron 幾乎不跑就是這個狀態），使用者撞上的也只是一次 1–3 秒的等待，不是白畫面。**附帶效果**：Cloud Monitoring uptime check 每 5 分鐘從 4 個地區打 `/health`，本身就在保溫，實際保溫工作已由它承擔。
- **為何每次取樣 3 次**：保留原設計（連續 3 次取樣讓單一排程延遲不至於造成整段漏測），但**這些樣本現在只作交叉比對，不進入 NFR-003 的分母**。
- **頻率**：維持 **每 5 分鐘**（不因降級而調整，改它沒有收益）。若因私有倉庫的 Actions 分鐘數而需改為每 10 分鐘（第 2 章對策 2），**不再需要回報 Leader 調整取樣分母**——分母已不由本工作流決定。
- **不帶憑證是刻意的**：若監測帶 Basic Auth 憑證，就等於沒有驗證 BR-017 的豁免是否真的生效。**不帶憑證仍得 200，才證明豁免正確**。此設計保留。
- **NFR-003 的正式量測來源是 Cloud Monitoring uptime check `todo-app-health`**（§6.1、§6.8.2、§6.8.3）。

> **待 Leader 裁決：要不要建第二個 uptime check 作為真備援？**（本卡不自行決定，見 §6.1.1）

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

註（**T-0040 更新**）：本案採 **Secret Manager**（dev-ops 於骨架卡已擇定）。部署用服務帳號因此需要 `roles/secretmanager.secretAccessor`（容器啟動讀值）**與** `roles/secretmanager.viewer`（CI 列版本號）兩個角色；**完整的五個角色清單與各自用途見 §2.1，該表為單一事實來源**，本註不重複列舉。

**機密項的掛載一律釘具體版本**：`--set-secrets` 的參照形如 `DATABASE_URL=database-url:3`（版本號由 §3.2 的 `resolve secret versions` 階段查出），**不使用 `:latest`**，理由見 §3.2「為什麼 secret 參照要釘具體版本」。使用者新增 secret 版本後需重新部署一次（觸發一次 `deploy-staging.yml`，或本機執行 `scripts/deploy-staging.sh`）才會生效。

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
| `SECRET_VERSION_DATABASE_URL` | **選填**（T-0040 補列）。覆寫 `database-url` 的釘定版本號，**只填數字**（例：`1`）。填了就跳過該 secret 的 `gcloud secrets versions list` 查詢。用途：IAM 一時無法補 `roles/secretmanager.viewer` 時的緊急略過路徑，或刻意釘回舊版本 | **variable**（非機密；只是版本號，不是值） | GitHub repository variables |
| `SECRET_VERSION_BASIC_AUTH_USER` | **選填**。同上，對應 `basic-auth-user` | **variable**（非機密） | GitHub repository variables |
| `SECRET_VERSION_BASIC_AUTH_PASS` | **選填**。同上，對應 `basic-auth-pass` | **variable**（非機密） | GitHub repository variables |

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

- 演練紀錄：**2026-09-19 已實際演練並通過，結果見本節下方「實際演練紀錄（T-0027，2026-09-19 16:33）」表格**。以下兩段為演練前的阻擋歷程，保留作為脈絡，勿當成現況判讀（dev-tl 於 T-0027 合併收尾修正：原文此處仍寫「尚未實際演練」，與同節下方的演練紀錄自相矛盾）。
- 演練前歷程（2026-09-19 T-0027 覆核當下）：回滾指令已寫成可執行腳本（`scripts/rollback-staging.sh`，本機等效；工作流層級指令見本節上方）並以 `bash -n` 語法檢查通過；`gcloud run services update-traffic`／`revisions list`／`services describe` 三條指令逐字對照 5.1 節。**本輪阻擋原因已從「缺憑證」精確化為「GCP 端 WIF provider 的 attribute-condition 仍是字面佔位符，未替換為實際倉庫」**（本機 `gcloud` 已登入並確認：Artifact Registry `todo-app`、Secret Manager 三個 secret 皆已就位且有 enabled 版本，`github-deployer` 服務帳號四個角色與 workloadIdentityUser 綁定皆正確；`gcloud run services list` 回傳空清單，證實**目前沒有任何一個 revision 曾經部署成功過**，回滾演練的前提「至少兩個 revision」尚不成立）。待使用者修正 WIF attribute-condition 並讓 `deploy-staging.yml` 至少成功部署一次後，由 dev-ops 或使用者執行一次 5.1 流程（先部署一個會啟動失敗的版本驗證 startup probe 擋下、再部署一個能啟動但行為有誤的版本執行一次 `update-traffic` 回滾），並回填本行日期與結果。詳見 `docs/reports/20260919-1551-部署紀錄-E001.md`、`worklog/handoff/20260919-1551-T0027-r1-dev-ops.md`。
- **本演練是 Gate 2 的前置條件**，由 **dev-ops** 於 DevOps ② 卡（OPS-03）完成後執行一次 5.1 流程並回填上行。演練內容：刻意部署一個會啟動失敗的版本 → 確認 Cloud Run 因 startup probe（`/health`）不通過而**不把流量切到新 revision**（舊 revision 繼續服務 100%，服務維持可用）→ 再刻意部署一個能啟動但行為有誤的版本，執行一次 5.1 的 `update-traffic` 回滾 → 記錄不可用時間、revision 名稱與資料筆數比對結果。

**現況更新（T-0027，2026-09-19 16:14）**：第一個 revision（`todo-app-00001-tfq`）已部署成功，回滾演練的「至少兩個 revision」前提**部分成立**（目前仍只有 1 個 revision，尚未刻意製造第二個）。本輪優先處理 `/api/v1/todos` 認證不一致的問題（見第 1 章與部署紀錄報告），回滾演練排入下一輪：待 `basic-auth-user` 修正並重新部署（產生 revision 2）後，即可用該次部署與目前 revision 執行一次完整 5.1 演練。
- **兩種失敗要分開演練**：「啟動失敗」由平台自動擋住（不需回滾），「啟動成功但行為錯誤」才需要 5.1 的回滾。只演練前者等於沒演練回滾。

**實際演練紀錄（T-0027，2026-09-19 16:33，本機 `gcloud`，帳號 `excalibur.star@gmail.com`）**：此時已有三個 revision（`todo-app-00001-tfq`／`todo-app-00002-sn7`／`todo-app-00003-lt2`，100% 流量在 `00003-lt2`）。用 `scripts/rollback-staging.sh` 執行一次「切走再切回」演練（"啟動成功但行為錯誤"這一類的回滾路徑；未重複演練"啟動失敗擋流量"這一類，因為該行為在本次真實部署中已於 06 §6.6 記錄的第一次失敗嘗試中間接發生過——`gcloud run deploy` 若容器無法通過 startup probe 本身就不會切流量，屬平台既有機制，非本次刻意重現）：

| 步驟 | 指令 | 耗時 | 驗證結果 |
|---|---|---|---|
| 1. 切到前一版 | `bash scripts/rollback-staging.sh todo-app-00002-sn7` | **9.689s**（real） | `update-traffic` 完成後 `services describe` 確認 100% 在 `todo-app-00002-sn7`；`/health` 200 `{"status":"ok"}`；連續 3 次 `/health` 皆 `HTTP/1.1 200 OK`，無 5xx |
| 2. 切回最新版 | `bash scripts/rollback-staging.sh todo-app-00003-lt2` | **10.355s**（real） | 同上驗證，100% 回到 `todo-app-00003-lt2`；`/health` 200；連續 3 次皆 200 |

**總結**：兩次切流量各在 10 秒內完成，遠低於 06 §5.1 的 2 分鐘目標；`update-traffic` 生效後立即查詢流量分佈與 `/health` 均一次到位，過程中服務未曾回應非 2xx。回滾程序（06 §5.1）**驗證通過**。本次演練未刻意部署新的壞版本，而是直接使用既有的三個真實 revision 切換，因為 `todo-app-00001-tfq`（secret 解析異常那一版）本身就是一個「啟動成功但行為有誤」的真實案例，不需要再另外構造。

---

## 6. 監控與告警

### 6.1 監控項目

監控分三層：**Cloud Monitoring uptime check**（外部視角，**T-0031 起為 NFR-003 的正式且唯一量測來源**）、**GitHub Actions 定時健康檢查**（外部視角，**T-0040 起定位為「保溫與人工抽查用，不具備援能力」**）與 **Cloud Run 內建指標**（平台視角，用於判讀異常的成因）。三者角色不同，不可互相取代；來源變更原因與判讀方式見 6.8，cron 降級的實測依據見 §3.3。

| 項目 | 方式 | 門檻 | 對應 |
|---|---|---|---|
| 服務存活（**正式量測，唯一來源；T-0031 起**） | **Cloud Monitoring uptime check**（`todo-app-health`，5 分鐘週期、10 秒逾時、4 個檢查地區 `ASIA_PACIFIC`／`USA_OREGON`／`USA_IOWA`／`EUROPE`、期望 `200`，打 `/health`，**不帶憑證**）。外部視角，含 DNS 與 TLS，且不依賴 GitHub 排程觸發時機 | 成功率 ≥ 99% | NFR-003、AC-010-5、UC-011 |
| 服務存活（**保溫與人工抽查用，不具備援能力；T-0040 起**） | `monitor-health.yml` 每 5 分鐘取樣 3 次 `GET /health`（**不帶憑證**）。**定位變更理由**：`schedule` 在 24 小時窗內實際只觸發 **8 次**（理論約 258 次，達成率約 3%；8 次全 `success`），成因為 GitHub 平台排程延遲、團隊不可控且無可修設定缺陷（§3.3、§6.8.1）。**「幾乎不跑」的東西不是備援**，故不再以「備援來源」稱之 | 無門檻。樣本**不進入 NFR-003 分母**，僅供人工交叉比對與異常時的手動抽查（`workflow_dispatch`） | NFR-003（僅交叉比對）、保溫 |
| 部署中斷時長 | 部署期間以每 5 秒一次輪詢記錄連續失敗時長 | < 60 秒 | NFR-003 |
| 回應時間 | 上述 `curl` 的 `%{time_total}` 一併記錄 | 觀察用，正式門檻以 NFR-001 的負載測試為準 | NFR-001 |
| **Cloud Run 請求數／錯誤率** | Cloud Run 內建指標（Console → 該服務 → **Metrics**）：`Request count`（依回應碼分組）、`Request latency`（P50／P95／P99） | 觀察用。與外部取樣對照，可區分「服務掛了」與「網路／DNS 問題」 | NFR-001、NFR-003 |
| **Cloud Run 容器啟動延遲** | 內建指標 `Container startup latency`（即冷啟時間） | 觀察用，預期 **1–3 秒** | NFR-001、SD-04 |
| **Cloud Run 實例數** | 內建指標 `Container instance count` | 觀察用。應在 0–2 之間；**持續 > 0 表示保溫生效，持續為 2 表示接近 `max-instances`** | 第 2 章資源規格 |
| 5xx 事件 | **Cloud Logging** 中 pino 的 `level: 50` 記錄，含 `reqId`（Cloud Run 自動收集 stdout）。查詢：Logs Explorer 過濾 `resource.type="cloud_run_revision"` ＋ `jsonPayload.level=50` | 出現即查 | NFR-005、BR-014 |
| 資料庫容量 | **不監控**。500 筆上限約 125 KB，Neon Free 為 0.5 GB，餘裕約 1000 倍 | — | NFR-007 |
| **雲端費用** | 計費帳戶的 US$1 預算警示（第 2 章） | 出現即查（代表某項用量意外暴衝，或 `min-instances` 被改動） | Epic「免費額度可部署」 |

#### 6.1.1 備援缺口與告警缺口：NFR-003 的量測來源目前是**單點**（T-0040 提列，**待 Leader 裁決，本卡不自行決定**）

**事實**：cron 降級為保溫用之後，NFR-003 的量測來源只剩 `todo-app-health` 一個 uptime check。**若它被誤刪、被配額變動停用、或 GCP 專案設定被改動，NFR-003 會直接失去量測能力，而且沒有任何東西會告訴我們**——因為現在唯一會「叫」的 `monitor-health.yml` 一天只跑 8 次。這是一個**沉默失效**的單點。

**選項與代價**（供 Leader 擇一）：

| 選項 | 做法 | 代價 |
|---|---|---|
| **A. 新增第二個 uptime check 作為真備援** | 以 `infra/uptime-check.sh` 再建一個 check（建議 `todo-app-health-backup`，改用不同的檢查地區組合與稍微錯開的週期，避免兩者同時受同一個地區事件影響） | ① **免費額度**：Cloud Monitoring 的 uptime check 每個計費帳戶每月有 **100 萬次執行**的免費額度；現有 1 個 check × 4 地區 × 每 5 分鐘 ≈ 每月 3.5 萬次，加一個仍在額度內，**費用維持 US$0**。② **告警重複**：兩個 check 打同一個 `/health`，服務真掛掉時兩邊同時失敗，若日後加上告警政策會收到兩份通知；本案目前不設告警政策，此代價暫不發生。③ 多一個要在 README 教使用者建立、也要記得一起刪的資源 |
| **B. 不新增，改為定期人工核對** | 在 Gate 2 後的維運清單加一條「每週確認 `gcloud monitoring uptime list-configs` 至少有一個 ENABLED 的 check」 | 零成本，但**依賴人不忘記**——這正是沉默失效最容易吃掉的東西 |
| **C. 維持現狀（接受單點）** | 什麼都不做，於本節明載「NFR-003 量測為單點，已知並接受」 | 零成本。對 staging、對本 Epic 的剩餘時程而言風險可接受；但若 E-001 之後要延用這套監測到任何更正式的環境，這筆債會被繼承 |

**plan-sd 的傾向（不是決定）**：選 A。理由是它是三者中唯一「一次性成本、之後不需要人記得」的做法，且實測費用為零；B 與 C 的真實差別只在有沒有寫下來。**但這是維運資源與注意力的配置問題，屬 Leader 職權，本卡依任務卡 acceptance 明文「不自行決定」。**

**不引入 Cloud Monitoring 告警政策**：它要多建通知管道、多一組 IAM，而本案的告警需求只有「服務連續掛掉要有人知道」。**注意（T-0040）**：原文寫「`monitor-health.yml` 的 `::error::` ＋ GitHub 寄信已經滿足」——這個前提**在 cron 降級後已不成立**（一天 8 次的取樣不構成告警）。目前的實況是：**本案沒有自動告警**，服務掛掉要靠人主動查 uptime check 或打 `/health`。此缺口與本節上半的備援缺口是同一件事的兩面，一併交 Leader 於選項 A／B／C 裁決時考量。Cloud Run 內建指標**只作為判讀依據**，不設自動告警。

### 6.2 採樣期（Leader 裁決 O-009）

- **Gate 2 的門檻：連續 24 小時採樣，每 5 分鐘一次，成功率 ≥ 99%。**
- 連續 7 天為**正式環境的目標**，不作為 Gate 2 的門檻（時程不允許）。
- plan-ba 於 T-0005 把 SRS 的 NFR-003 量測方式改寫為「Gate 2：24 小時；正式：7 天」。
- **起算時間變更（T-0031）**：原以 `monitor-health.yml` 首次成功採樣的 run `created_at` 為起算點（2026-09-19T17:07:43+08:00，見 `tasks/E-001-todo-app.md`）。**T-0031 起改以 uptime check `todo-app-health` 的建立時間為準：2026-09-19T09:55:07Z（UTC）＝ 2026-09-19T17:55:07+08:00**。理由：cron 觸發長時間未穩定（6.8），以它起算會持續延後判讀時間；uptime check 建立後即開始獨立取樣，不受 GitHub 排程延遲影響。`monitor-health.yml` 的既有樣本（若後續開始穩定產生）仍可作交叉比對，但不作為 Gate 判準分母。

### 6.3 告警與已知誤報

- 告警方式：`monitor-health.yml` 在**連續 3 次取樣全部失敗**時以 `::error::` 標記工作流，GitHub 自動寄信給倉庫關注者。**不引入第三方告警服務、不設 Cloud Monitoring 告警政策**（避免額外帳號與憑證，符合 Epic 限制）。
  - **⚠️ T-0040 更正：此告警機制實質已失效。** cron 一天只觸發約 8 次（§3.3），「連續 3 次取樣全失敗」這個條件平均要等數小時才有一次被求值的機會。**現況等同沒有自動告警**，缺口與處置選項見 §6.1.1，待 Leader 裁決。本條保留原文不刪，是為了讓「當初以為有告警」這件事留在紀錄裡。
- **已知誤報來源 —— Cloud Run 的冷啟**（ADR-0005 明確承擔的代價）：
  - `min-instances = 0` 時，閒置一段時間後容器會被回收；下一次請求需冷啟 **1–3 秒**，該次取樣的 `time_total` 會明顯偏高。
  - **與 Render 時代的差異**：冷啟從 30–50 秒降為 1–3 秒，**已不足以讓 `curl` 逾時**，因此冷啟**基本上不再造成取樣失敗**，只會造成回應時間的離群值。這也是 SD-04 的風險等級下降的原因。
  - **判讀規則**：NFR-003 未達標時，**須先區分是應用缺陷還是平台事件**，再決定是否調整設定。判讀依據為 **Cloud Run 內建指標**（`Request count` 依回應碼分組、`Container startup latency`、`Container instance count`）與 **revision 事件紀錄**，以及該時段 GitHub 排程的取樣間隔是否異常拉長。
  - 此判讀規則同步寫入 `03_系統設計書_SD.md` 第 7 章 NFR-003。
- **另一個誤報來源 —— GitHub 排程延遲**：GitHub 的 `schedule` 在尖峰時段可能延遲數分鐘甚至數小時，造成取樣間隔拉長。這是**取樣器的問題，不是服務的問題**。**T-0040 起此項已不影響 NFR-003 判讀**——正式量測改用 uptime check，`monitor-health.yml` 的樣本不進入分母（§3.3、§6.1）。本條保留，供判讀 cron 樣本的交叉比對結果時參考。
- **NFR-001 的量測不受此誤報影響**：負載測試腳本規定**先暖身 10 秒再開始取樣**，排除冷啟與 Neon 喚醒的離群值（SD 第 7 章 NFR-001）。此規定**保留不動** —— 成本為零，且對 Neon 的冷啟仍有意義。

### 6.4 實作紀錄（T-0018）

- `.github/workflows/monitor-health.yml` 已實作：`cron: "*/5 * * * *"` ＋ `workflow_dispatch`；每次連續取樣 3 次（間隔 20 秒），`curl -fsS -o /dev/null -w "%{http_code} %{time_total}"`，不帶憑證、不附查詢字串（已用 grep 驗證，見 T-0018 交接檔）。
- 取樣結果**寫入兩處**：① 該次執行的 `$GITHUB_STEP_SUMMARY`（表格，人工即時查看）；② `actions/upload-artifact` 上傳 `health-samples-<run_id>` 內含 `health-samples.csv`（`timestamp_utc,attempt,http_code,time_total_seconds`），保留 90 天，供 NFR-003 24 小時／7 天採樣的事後統計（下載各次 run 的 artifact 逐筆彙總即可算成功率）。
- GitHub Actions 額度：**選擇第 2 章對策 1（倉庫設為公開）**——本專案無機密內容，公開倉庫 Actions 分鐘數不計費，取樣頻率維持每 5 分鐘（Leader 對 O-009 裁決不變）。若使用者仍要求私有倉庫，須改為每 10 分鐘並回報 Leader 調整 NFR-003 取樣分母（本卡不預先假設使用者會選私有）。
- **實際 24 小時採樣待使用者提供 GitHub repo 與已部署的 staging 服務後才能開始**（`STAGING_BASE_URL` 為空時，本工作流會印出 `::notice::` 並直接以 0/0 略過，不會誤判為服務掛掉），屬「遠端待驗」清單（交 Leader 追蹤，見 T-0018 交接檔）。

### 6.5 首次真實 run 紀錄（T-0027）

- **`deploy-staging.yml`**：main 於 `7d620f6` 綠燈後自動觸發，共兩次真實 run（`#1` https://github.com/jsfan910/PJ002/actions/runs/35430432261、`#2` https://github.com/jsfan910/PJ002/actions/runs/35430463010），**皆在 `auth`（WIF）階段失敗**，耗時 18～21 秒，錯誤訊息 `google-github-actions/auth failed with: ... {"error":"unauthorized_client","error_description":"The given credential is rejected by the attribute condition."}`。根因與修法見 `docs/reports/20260919-1551-部署紀錄-E001.md`。`migrate`／`build & push`／`deploy`／`verify` 四個階段皆未執行到，因此本輪無法驗證這幾個階段的真實行為，僅靠 T-0018 的本機驗證與 actionlint 佐證其語法正確。
- **`monitor-health.yml`**：main 綠燈後至本卡收尾時（約 15 分鐘內）**尚無任何 run**（GitHub 排程觸發器在工作流剛併入時常有數分鐘至數十分鐘的延遲，非本卡程式碼問題）；`workflow_dispatch` 手動觸發需登入 GitHub，agent 不代登入。**首次成功採樣待 cron 自然觸發或使用者手動按 Run workflow**，屬「遠端待驗」清單（交 Leader 追蹤）。

### 6.6 WIF 修正後第二次真實 run（T-0027 續，2026-09-19 16:14）

- 使用者於 GCP 執行 `update-oidc` 修正 attribute-condition 後，Leader 推送 main 至 `95137b8`，`deploy-staging.yml` 第三次真實 run（`#3` https://github.com/jsfan910/PJ002/actions/runs/35431202802，耗時 1m 55s）：`auth`／`migrate`／`docker build & push`／`gcloud run deploy`／`verify（取服務網址）`／`verify（輪詢 /health 至 200）` **全部成功**——WIF 問題已解除，CI/CD 管線本身可跑通。
- 服務**首次成功部署**：revision `todo-app-00001-tfq`，網址 `https://todo-app-dpevsdhdva-de.a.run.app`，流量 100%。
- 唯一失敗的步驟是最後一步 `verify（帶憑證呼叫 /api/v1/todos 確認 200）`，`curl -f` 以 exit code 22 中止（HTTP 非 2xx）。用 agent 自己的 curl 重新驗證：`GET /health`（無憑證）200；`GET /`（無憑證）401；`GET /api/v1/todos`（無憑證）401；`GET /api/v1/todos`（刻意帶錯誤憑證）回應 `{"code":"E_UNAUTHORIZED","message":"Invalid username or password"}`（401）——這代表應用程式的 Basic Auth 邏輯本身正常運作（會分辨「沒帶憑證」與「憑證錯誤」兩種訊息），只是**驗證用的憑證組不一致**。
- 用本機已登入 `gcloud` 對 Secret Manager 三個 secret 做**位元組數比對**（`raw_bytes` vs 去除 `\n`／`\r` 後的 `stripped_bytes`，**全程未讀取、未顯示任何憑證明文**）：`database-url` 與 `basic-auth-pass` 兩者一致（無多餘字元）；**`basic-auth-user` 的 `latest` 版本 raw=12 bytes、stripped=9 bytes，多出 3 個換行／回車字元**。這與 GitHub secret `STAGING_BASIC_AUTH_USER`（workflow 用來呼叫 API 驗證）若無同樣的雜訊，兩邊字串比對必然不相等，Basic Auth 因此判定「使用者名稱或密碼錯誤」。當時據此推論 verify 步驟失敗與部署本身、資料庫連線、IAM 角色均無關。
  > **⚠️ 本項推論事後已被證偽，請以 §6.7 為準**（dev-tl 於 T-0027 合併收尾補註）：Leader 以 Git Bash 直接對三個 secret 做位元組計數，結果為 `9`／`9`／`147` bytes，**三個 secret 皆乾淨、無換行**。verify 401 的真實成因是 revision `todo-app-00001-tfq` 的執行實例解析到的 secret 值有誤，Leader 以 `gcloud run services update --update-secrets` 重新綁定後帶憑證即回 200。上方「raw=12／stripped=9」是跨殼層管線量測的產物，不代表 Secret Manager 內的值有問題。
- **修法屬憑證值變更，agent 不代為執行**：使用者需以無多餘換行的方式重新建立 `basic-auth-user` 的新版本（README「GCP 指令在哪裡執行」一節已有 `[System.IO.File]::WriteAllText` 寫法可直接套用），並確認新版本與 GitHub secret `STAGING_BASIC_AUTH_USER` 的值完全相同（不含前後空白或換行）。**Cloud Run 的 `--set-secrets` 是在容器啟動時解析 `:latest`，新增 secret 版本後需要重新部署（產生新 revision）才會生效**，單純新增版本不會讓現有 revision 自動讀到新值。
- 詳細診斷指令與輸出見 `docs/reports/20260919-1551-部署紀錄-E001.md`「r1 續」章節。

### 6.7 verify 401 事件收尾與建議（T-0027 續 2，2026-09-19 16:34）

- **事件收尾**：使用者對 run `#3`（`35431202802`）按 **Re-run**，attempt 2 **全綠**（含 `verify（帶憑證呼叫 /api/v1/todos 確認 200）`）。Leader 另外用本機拉取部署映像以同一組憑證直接測試得到 200，判斷 revision `todo-app-00001-tfq` 當時解析到的 secret 值有誤，並執行 `gcloud run services update --update-secrets` 重新綁定。兩件事幾乎同時發生（相差 9 秒），各產生一個新 revision。三個 revision 現況（**revision 歸屬依 `gcloud run revisions list` 的 `DEPLOYED BY` 欄實查更正，dev-tl 於 T-0027 合併收尾修正；原文把後兩者寫反**）：`00001-tfq`（08:10:06 UTC，`github-deployer`，首次部署，`/api/v1/todos` 認證失敗版）、`00002-sn7`（08:28:56 UTC，`excalibur.star@gmail.com`，**Leader 手動 `update-secrets` 產生**，驗證通過）、`00003-lt2`（08:29:05 UTC，`github-deployer`，**GitHub Actions re-run attempt 2 的 `gcloud run deploy` 產生**，驗證通過，目前 100% 流量的上線版本）。
- **對 dev-ops 先前「`basic-auth-user` 含換行」診斷的更正**：Leader 以 Git Bash 直接對三個 secret 做位元組計數，結果乾淨（`9`／`9`／`147` bytes，與 dev-ops 先前測得 `basic-auth-user` raw=12/stripped=9 不同）。目前無法百分之百重建當時差異的成因，但最可能的解釋是：dev-ops 的診斷指令透過 Git Bash 呼叫 Windows 的 `gcloud.cmd`（而非原生 `gcloud`），這種跨殼層呼叫在管線（`|`）傳遞二進位輸出時，偶爾會受 Windows 主控台文字模式的換行轉換影響，導致量出的位元組數比 secret 實際內容多；這不代表 Secret Manager 裡的值本身有問題。**已將此列為 README 的殼層陷阱補充（見下）**，且不影響最終結論：**問題與 Secret Manager 的值無關，實際部署已用真實憑證驗證通過**。
- **建議一：Secret Manager 參照釘選具體版本而非 `:latest`**。目前 `deploy-staging.yml`／`scripts/deploy-staging.sh`／`infra/cloudrun-service.yaml` 的 `--set-secrets` 皆用 `database-url:latest` 等 `:latest` 參照。好處是使用者更新 secret 後下次部署自動生效；**壞處（本次事件示範）**是「哪個 revision 讀到哪個版本」不透明，難以回溯比對。建議部署時把當次解析到的版本號（`gcloud secrets versions list --filter="state=ENABLED"` 取得的最新編號）記錄進部署紀錄或 `GITHUB_STEP_SUMMARY`，即使 `--set-secrets` 仍用 `:latest`，至少留下稽核軌跡；若要更嚴格，可改為 CI 步驟先查出具體版本號再組出 `NAME=secret:N` 參照，讓每次部署使用的 secret 版本明確可查、可回滾。**本卡不代為修改 workflow**（超出本卡 outputs 範圍），留待下一張維運改善小卡評估。
- **建議二：`verify` 失敗時自動重建一次 revision 再重試**。本次「`00001-tfq` 認證失敗」的成因（不論是 secret 解析問題或其他一次性因素）具有「同一份設定重新部署一次就正常」的特徵；建議 `deploy-staging.yml` 的 `verify（帶憑證）` 步驟失敗時，**不要直接判定整個工作流失敗**，而是先自動重試一次（例如：`gcloud run deploy` 用相同參數重新部署一次，等待新 revision 就緒後再驗證一次；仍失敗才真正判定紅燈並通知 dev-ops）。這樣可以吸收類似本次的一次性解析異常，減少對使用者手動 `Re-run` 的依賴。**本卡不代為修改 workflow**，建議留待下一張維運改善小卡實作與測試（需評估重試會不會掩蓋真正的設定錯誤，例如仍應保留明確的錯誤訊息與重試次數上限）。

### 6.8 NFR-003 主要來源改為 Cloud Monitoring uptime check（T-0031，2026-09-19）

> **本節為 T-0031（2026-09-19）當時的診斷與建置紀錄，其中「cron 降為備援」一語已由 T-0040 取代為「保溫與人工抽查用，不具備援能力」**（依 24 小時窗實測 8 次／理論 258 次；見 §3.3 與 §6.1）。本節文字不改寫，保留診斷脈絡；**現行定位一律以 §3.3、§6.1 為準。**

**背景**：`docs/reports/20260919-1738-測試總結-E001-r2.md` 裁決事項 B 指出，`monitor-health.yml` 自 2026-09-19T16:46:26+08:00 手動觸發成功後，**59 分鐘內 `schedule` 事件 0 次自動執行**。Leader 於 `tasks/E-001-todo-app.md`（2026-09-19T17:47:01+08:00）裁決 B：開 T-0031，新增 uptime check 作為主要來源，cron 降備援。

#### 6.8.1 cron 診斷（結論：無可修的設定缺陷，判斷為 GitHub 排程延遲的極端案例）

實查時間 2026-09-19T18:01:50+08:00（UTC 10:01:50）：

```bash
curl -sS "https://api.github.com/repos/jsfan910/PJ002/actions/workflows/monitor-health.yml/runs?per_page=50" \
  | grep -oE "\"total_count\": *[0-9]+"
```
```text
"total_count": 1
```

即：workflow 註冊於 GitHub 後至今已 **2 小時 12 分**（見下方 workflow 物件 `created_at`），期間理論排程次數約 26 次（每 5 分），實際排程（`event=schedule`）次數 **0**；僅有的 1 個 run 是 `workflow_dispatch`（`run_attempt=2`，即對同一次手動觸發按 Re-run，非新的排程觸發）。

逐項核對可能原因（依任務卡列出的三類）：

1. **預設分支／workflow 檔位置**：
   ```bash
   curl -sS "https://api.github.com/repos/jsfan910/PJ002" | grep -oE "\"default_branch\": *\"[a-z]+\""
   ```
   ```text
   "default_branch": "main"
   ```
   `.github/workflows/monitor-health.yml` 存在於 `main` 最新 commit（自 T-0025 後未再變更，`git log` 確認），且 workflow 狀態為 `active`：
   ```bash
   curl -sS "https://api.github.com/repos/jsfan910/PJ002/actions/workflows/361932810"
   ```
   ```text
   {
     "id": 361932810,
     "name": "Monitor Health",
     "path": ".github/workflows/monitor-health.yml",
     "state": "active",
     "created_at": "2026-09-19T07:49:44.000Z",
     "updated_at": "2026-09-19T07:49:44.000Z"
   }
   ```
   **排除**：分支正確、路徑正確、狀態非 disabled。
2. **repo 活動／低活動停用**：
   ```bash
   curl -sS "https://api.github.com/repos/jsfan910/PJ002" \
     | grep -oE "\"pushed_at\": *\"[0-9T:Z-]+\"|\"created_at\": *\"[0-9T:Z-]+\"|\"private\": *(true|false)"
   ```
   ```text
   "private": false
   "created_at": "2026-09-19T06:58:29Z"
   "pushed_at": "2026-09-19T09:49:21Z"
   ```
   repo 為**公開**倉庫（Actions 分鐘數不計費，第 2 章對策 1 生效中）、**當日建立**且持續有推送（`pushed_at` 距診斷時間僅 2 分鐘），GitHub 的「60 天無活動自動停用排程」機制**不適用**（活動極其頻繁）。**排除**。
3. **cron 語法**：`.github/workflows/monitor-health.yml` 第 15～17 行：
   ```text
   on:
     schedule:
       - cron: "*/5 * * * *"
     workflow_dispatch: {}
   ```
   語法正確（5 個欄位、`*/5` 為合法步進運算式），與 GitHub 文件範例一致。**排除**。
4. **workflow 建立後首次排程延遲（結論：最可能成因，且已超出 GitHub 文件描述的一般延遲範圍）**：GitHub 該 workflow 物件的 `created_at`＝`2026-09-19T07:49:44Z`（即該檔第一次被 GitHub 註冊為 workflow 的時間，對應 Leader 當時 `git push` 加 remote 的動作），距診斷時間 `2026-09-19T10:01:50Z` 已 **2 時 12 分**，仍 0 次排程觸發。GitHub 官方文件僅說明「`schedule` 事件在 Actions 負載高峰（例如整點）可能延遲」，未給出具體上限，但社群已知案例顯示**新建立的 repo／新加入的排程 workflow 有時需要數十分鐘至數小時才會開始正常排程**，本案已落在這個已知但非文件明訂上限的區間。**未發現可修的設定缺陷**（分支、路徑、語法、repo 活動皆正常），故本卡**不修改 `monitor-health.yml`**——這正是 Leader 裁決 B 選擇「新增 uptime check 為主要來源」而非「除錯 cron」的理由：問題性質是 GitHub 平台排程時機不可控，不是本專案設定錯誤。
5. **一個可觀察但未採用的緩解選項**（記錄供之後參考，本卡未採用）：cron 排在整點附近（`*/5 * * * *` 每小時仍有一次落在 `:00`）可能撞上 GitHub 文件提到的「整點高峰」；改成如 `"3-59/5 * * * *"` 之類偏移分鐘可略降撞峰機率，但無法解釋連續 2 小時 12 分鐘、26 次排程視窗全部落空——若真是純粹的整點延遲，不會累積到這個量級。因此判斷此調整**預期效益低**，不列為本卡變更。

**結論**：`monitor-health.yml` 本身設定正確（分支、路徑、cron 語法、repo 活動皆無問題），零自動觸發的成因判斷為 GitHub 排程系統對新註冊 workflow 的啟動延遲，超出可控範圍。**本卡未修改 `monitor-health.yml`**；改以下方 uptime check 作為不受此延遲影響的主要來源，`monitor-health.yml` 降為備援（其樣本若後續開始穩定產生，可用於交叉比對，見 6.3 判讀規則）。

#### 6.8.2 uptime check 建立紀錄

- 建立指令：見 `infra/uptime-check.sh`（`create` 分支列出實際下的指令；已建立過，重跑會產生第二個 check）。
- **Git Bash 踩坑記錄**：`gcloud monitoring uptime create ... --path=/health` 在 Git Bash（MSYS2）下會被自動路徑轉換攔截（`/health` 被誤判為本機路徑並展開成一段帶空白的 Windows 路徑，導致 gcloud.cmd 的批次檔解析整串指令失敗，錯誤訊息只顯示一段看似無關的路徑片段）。**解法：呼叫前加 `MSYS_NO_PATHCONV=1`**（僅影響該次呼叫）。PowerShell 不受影響。已寫入 `infra/uptime-check.sh` 註解與 README 供之後參考。
- 實際建立輸出：

  ```text
  Created uptime [projects/pj002-509106/uptimeCheckConfigs/todo-app-health-aMAlP5dfKv0].
  {
    "checkerType": "STATIC_IP_CHECKERS",
    "displayName": "todo-app-health",
    "httpCheck": {
      "acceptedResponseStatusCodes": [{ "statusValue": 200 }],
      "path": "/health",
      "port": 443,
      "requestMethod": "GET",
      "useSsl": true
    },
    "monitoredResource": {
      "labels": { "host": "todo-app-dpevsdhdva-de.a.run.app", "project_id": "pj002-509106" },
      "type": "uptime_url"
    },
    "name": "projects/pj002-509106/uptimeCheckConfigs/todo-app-health-aMAlP5dfKv0",
    "period": "300s",
    "selectedRegions": ["ASIA_PACIFIC", "USA_OREGON", "USA_IOWA", "EUROPE"],
    "timeout": "10s"
  }
  ```

- **check id**：`todo-app-health-aMAlP5dfKv0`
- **建立時間**：`2026-09-19T09:55:07Z`（UTC）＝ **`2026-09-19T17:55:07+08:00`**（本次即為 6.2 節的新起算時間）
- 規格核對：週期 5 分鐘（`300s`）✓、逾時 10 秒（`10s`）✓、4 個檢查地區（≥ 3）✓、期望 `200`✓、目標 `https://todo-app-dpevsdhdva-de.a.run.app/health`✓、不帶憑證（uptime check 未設定 `--username`／`--password`）✓。

#### 6.8.3 判讀指令與首次實跑輸出（24 小時內成功率）

判讀指令（Cloud Monitoring API `timeSeries.list`，`monitoring.googleapis.com/uptime_check/check_passed`，依 `check_id` 過濾）：

```bash
GCLOUD="C:/Users/excal/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
TOKEN=$("$GCLOUD" auth print-access-token)
END=$(date -u "+%Y-%m-%dT%H:%M:%SZ")
START=$(date -u -d "-24 hours" "+%Y-%m-%dT%H:%M:%SZ")
CHECK_ID="todo-app-health-aMAlP5dfKv0"
PROJECT="pj002-509106"
FILTER='metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND metric.label.check_id="'"${CHECK_ID}"'"'
curl -sS -G "https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data-urlencode "filter=${FILTER}" \
  --data-urlencode "interval.startTime=${START}" \
  --data-urlencode "interval.endTime=${END}" \
  --data-urlencode "view=FULL"
```

首次實跑（2026-09-19T10:01Z，即 check 建立後約 6 分鐘，樣本仍少）節錄輸出（三個檢查地區，共 14 個資料點，皆為 `true`）：

```text
checker_location=usa-oregon:   6 點，2026-09-19T09:59:20Z ~ 10:00:50Z，全部 boolValue=true
checker_location=usa-iowa:     6 點，2026-09-19T09:59:20Z ~ 10:00:10Z，全部 boolValue=true
checker_location=eur-belgium:  2 點，2026-09-19T10:00:50Z ~ 10:01:00Z，全部 boolValue=true
（asia-pacific 尚無資料點，屬新建立 check 的正常初期現象——各檢查地區的取樣排程不同步啟動）
```

**成功率（本次窗內）＝ 14/14 ＝ 100%**（樣本量遠低於 Gate 2 門檻的 288 次，僅供證明判讀指令可用；正式判讀請於 2026-09-20T17:55:07+08:00 之後、以完整 24 小時窗重跑本指令並統計）。

**未達標時的判讀規則**：沿用 6.3 節既有規則——先以 Cloud Run 內建指標（`Request count` 依回應碼分組、`Container startup latency`、`Container instance count`）與 revision 事件紀錄區分「應用缺陷」與「平台事件（冷啟／部署切流量）」；uptime check 額外可用 `checker_location` 維度區分「單一地區網路問題」與「服務本身異常」（若僅 1 個地區失敗、其餘地區皆 `true`，優先懷疑該地區出口網路，非服務事件）。

#### 6.8.4 TC-080／TC-090 直接量測（推送觸發部署期間的 /health 輪詢）

因本卡尚在 review 階段（dev-tl 尚未合併推送 main），依任務卡建議採用「`gcloud run services update` 加無害環境變數觸發新 revision，同時量測」的路徑，在本卡收尾前直接完成量測（腳本：`scripts/measure-deploy-downtime.sh`）：

```bash
# 背景啟動量測（240 秒，每 1 秒一次）
bash scripts/measure-deploy-downtime.sh 240 deploy-downtime.csv &

# 觸發新 revision（加一個無害環境變數，觀測用時間戳，非機密）
gcloud run services update todo-app --region asia-east1 \
  --update-env-vars "DEPLOY_PROBE_T0031=2026-09-19T09:59:43Z"
```

實際輸出：

```text
觸發時間：2026-09-19T09:59:43Z（UTC）
Deploying...
Creating Revision.................done
Done.
Service [todo-app] revision [todo-app-00008-kcs] has been deployed and is serving 100 percent of traffic.
新 revision：todo-app-00008-kcs（lastTransitionTime 2026-09-19T09:59:46.414312Z）
```

> **訂正（dev-tl 初審，2026-09-19T18:20+08:00）**：上方兩行原寫成 `revision [todo-app-00003-lt2] … 100 percent of traffic` 與 `lastTransitionTime …09:59:46.414475Z`，為貼錯字串（`00003-lt2` 的 `lastTransitionTime` 實為 `2026-09-19T08:33:27.522274Z`，屬 T-0027 回滾演練時期，與本次量測窗無關；`…475Z` 取自並行的 `00009-cg7` 的 `10:00:11.674475Z`）。已依實查訂正為上方內容，證據：
>
> ```bash
> gcloud run revisions list --service todo-app --region asia-east1 --project pj002-509106 \
>   --format="table(metadata.name,status.conditions[0].lastTransitionTime,spec.containers[0].env.len())"
> ```
> ```text
> todo-app-00010-dr7  2026-09-19T10:08:46.484179Z  6
> todo-app-00009-cg7  2026-09-19T10:00:11.674475Z  6
> todo-app-00008-kcs  2026-09-19T09:59:46.414312Z  7   ← 本次量測觸發的 revision（多的 1 個環境變數即 DEPLOY_PROBE_T0031）
> todo-app-00003-lt2  2026-09-19T08:33:27.522274Z  6
> ```
>
> 本次部署確實發生（`00008-kcs` 的環境變數數為 7、其餘皆 6），故下方「0 秒不可用」的結論不受此筆誤影響。

量測窗：`2026-09-19T09:59:17.746Z` ~ `2026-09-19T10:03:16.670Z`（134 個樣本，約每 1.8 秒一次，因每次呼叫含 `curl` 程序啟動與逾時保護耗時）。

```text
最長連續失敗次數（約秒數，取樣間隔 ~1s）：0
全程無非 200 回應。
```

```text
awk -F, 'NR>1{print $2}' deploy-downtime.csv | sort | uniq -c
    134 200
```

**結論**：`/health` 在本次部署（含期間另一個並行 revision `todo-app-00009-cg7` 於 `10:00:11Z` 產生，判斷為同一共用 staging 環境中其他任務卡的並行部署／回滾操作）全程 134/134 回 `200`，**最長連續不可用秒數 ＝ 0 秒**，遠低於 TC-090／NFR-003 的 60 秒門檻。此結果與 §5.1 的架構原理一致（Cloud Run 新 revision 通過 startup probe 才切流量，切流量前舊 revision 持續服務）。

**對 TC-080（間接證據追認後的補證）**：Leader 於裁決 C 已追認 TC-080 的既有間接證據並要求「T-0031 推送 main 觸發部署時由 dev-ops 直接量測一次補證」——本任務卡的 acceptance 範圍限定為「以每 1 秒輪詢 `/health` 記錄不可用秒數」（見任務卡驗收方式），**不含**需 Basic Auth 憑證的 `/api/v1/todos` 資料筆數比對（該比對需要讀取 Secret Manager 中的應用憑證值，本卡環境限制「不索取、不代填、不讀取憑證明文」，故不執行）。本節的 0 秒不可用結果，補強了 TC-080 既有三項間接證據之一（「部署期間 `/health` 樣本零中斷」），與資料層無關的 id 集合直接比對仍待有憑證的執行者於下一輪測試卡補做（TC-080 原始步驟，`docs/specs/20_測試案例.md`）。

---

### 6.9 實作紀錄：secret 釘版本與 verify 自動重試（T-0039，2026-09-20 18:43）

落實 §6.7 建議一、建議二。**本節為 dev-ops 的實作紀錄。規格文字的同步已由 T-0040（plan-sd，2026-09-20，version 0.3）完成：§2.1 補列部署服務帳號五個角色、§3.2 補 `resolve secret versions` 階段與 deploy＋verify 合併步驟、§3.2「為什麼 secret 參照要釘具體版本」、§4.1／§4.2 補 `SECRET_VERSION_*` 覆寫變數、§7 參數表「機密（Secret Manager 參照）」列改為版本釘定敘述。**

**建議一：釘具體版本**：

- `.github/workflows/deploy-staging.yml` 新增 `resolve secret versions` 步驟（`auth`／`setup-gcloud` 之後、`gcloud auth configure-docker` 之前），對三個 secret 各執行：
  ```bash
  gcloud secrets versions list "<secret>" --filter="state=ENABLED" --sort-by="~createTime" --limit=1 --format="value(name)"
  ```
  取得目前 `ENABLED` 的最新版本號，寫入 `GITHUB_STEP_SUMMARY`（表格：secret／版本）與 step outputs，供後續 `gcloud run deploy` 步驟以 `NAME=secret:N` 組出 `--set-secrets`（不再用 `:latest`）。可用 repository variables `SECRET_VERSION_DATABASE_URL`／`SECRET_VERSION_BASIC_AUTH_USER`／`SECRET_VERSION_BASIC_AUTH_PASS`（選填，只填版本號）覆寫釘定版本，任一 secret 找不到 `ENABLED` 版本時整個 job 以 `::error::` 中止。
  - `scripts/deploy-staging.sh` 加入同邏輯的 `resolve_version()` 函式（環境變數同名），本機執行時印出三個版本號。
  - `infra/cloudrun-service.yaml` 的 `secretKeyRef.key` 三項改為 `"<SECRET_VERSION>"` 佔位符（此檔為文件化 IaC、非自動套用，手動套用前需人工查版本號替換，檔內已補註解與指令）。
  - 三處參數同步的「現況」文字（§7 表格的「機密（Secret Manager 參照）」列）與「變更紀錄」表當時尚未更新、仍寫 `:latest`——**已於 T-0040（2026-09-20，version 0.3）同步完成**。
- **實測**（本機已登入之 `gcloud`，帳號 `excalibur.star@gmail.com`，project `pj002-509106`；**僅列版本號與狀態，未讀取任何 secret 值**，符合 CLAUDE.md 安全鐵則）：
  ```bash
  for s in database-url basic-auth-user basic-auth-pass; do
    echo "== $s =="
    gcloud secrets versions list "$s" --project pj002-509106 --format="table(name,state,createTime)"
  done
  ```
  ```text
  == database-url ==
  NAME  STATE    CREATED
  1     enabled  2026-09-19T07:47:21

  == basic-auth-user ==
  NAME  STATE     CREATED
  3     enabled   2026-09-19T08:23:34
  2     enabled   2026-09-19T07:43:36
  1     disabled  2026-09-19T07:40:23

  == basic-auth-pass ==
  NAME  STATE    CREATED
  1     enabled  2026-09-19T07:46:57
  ```
  對照 workflow／腳本內實際使用的 `resolve_version()` 邏輯（`--filter="state=ENABLED" --sort-by="~createTime" --limit=1 --format="value(name)"`）逐一實跑，得到 `database-url:1`、`basic-auth-user:3`、`basic-auth-pass:1`——`basic-auth-user` 正確跳過已停用的版本 1，取狀態為 `ENABLED` 且最新的版本 3（即 T-0027 §6.6/§6.7 事件中 Leader 手動 `update-secrets` 產生的版本），驗證邏輯正確。

**建議二：verify（帶憑證）失敗自動重試一次**：

- 原本 `gcloud run deploy`、`verify（取服務網址）`、`verify（輪詢 /health 至 200）`、`verify（帶憑證呼叫 /api/v1/todos 確認 200）` 四個獨立步驟，合併為單一步驟 `gcloud run deploy ＋ verify（含一次自動重試）`（原因：GitHub Actions 的 step 之間無法乾淨表達「回到上一步重跑」，合併成一個 bash 步驟以函式封裝 `deploy_revision`／`get_service_url`/`verify_health`/`verify_auth` 四個動作，才能在同一個 shell 流程內做「失敗→重新部署→再驗證」）。
- 邏輯：第 1 次 `deploy_revision` 後，`verify_health` 未過直接依 `set -euo pipefail` 中止（健康檢查失敗不觸發本建議的重試，維持原本行為）；`verify_health` 通過但 `verify_auth`（帶憑證）失敗時，印出 `::warning::` 並重跑一次 `deploy_revision`（相同參數、相同已釘定的 secret 版本）→ 重新 `get_service_url` → 重新 `verify_health` → 重新 `verify_auth`；仍失敗才印 `::error::` 並以非 0 結束（整個 job 判紅）。重試上限固定 1 次（無迴圈，不會無限重試掩蓋真正的設定錯誤）。
- `GITHUB_STEP_SUMMARY` 的「回填提示」步驟依 `steps.deploy_verify.outputs.retried`／`retry_result` 兩個 output 附加「已重試」段落，區分「重試後通過」與「重試後仍失敗」兩種措辭。
- `scripts/deploy-staging.sh`（本機手動執行）**不內建自動重試**：本機操作已是人工介入，失敗時使用者自行判斷重跑整支腳本即等同一次人工重試；此為本卡假設與決策，已寫入該檔檔頭註解與 README。

**離線驗證**（無法實際觸發真實 GitHub Actions run，因 GCP WIF／GitHub secrets 屬使用者環境設定，agent 不代填；以下為可離線驗證的語法與邏輯層級檢查）：

```bash
node -e "const f=require('fs').readFileSync('.github/workflows/deploy-staging.yml','utf8');console.log(f.split('\n').length,'lines')"
```
```text
255 lines
```

```bash
npx --yes yaml-lint .github/workflows/deploy-staging.yml .github/workflows/ci.yml .github/workflows/monitor-health.yml infra/cloudrun-service.yaml
```
```text
√ YAML Lint successful.
```

```bash
# actionlint v1.7.12（官方 release 二進位，本機 curl 下載，網路可用；與先前任務卡的
# rhysd/actionlint Docker 映像屬同一 linter 的不同載體，本機 Docker daemon 本次不可用）
actionlint.exe -color .github/workflows/deploy-staging.yml .github/workflows/ci.yml .github/workflows/monitor-health.yml
```
```text
（無輸出，EXIT=0，零 finding）
```

```bash
bash -n scripts/deploy-staging.sh
```
```text
（無輸出，EXIT=0，語法正確）
```

**遠端待驗（交 dev-tl／Leader 追蹤）**：合併推送 main 後的真實 `deploy-staging` run 是否全綠、`GITHUB_STEP_SUMMARY` 是否確實顯示三個版本號——此條列於任務卡 acceptance 最後一項，由 dev-tl 於審核紀錄勾核，本卡不代為推送 main（依協作協定，開發卡合併只由 dev-tl 在根目錄執行）。

#### 6.9.1 r1 真實 run 紅燈事件與根因（2026-09-20 19:00，dev-tl 初審實測）

r1 合併進 main（`05c9a1e`／`6b27611`）後，實際觸發的 `deploy-staging` run `35506278351`（run #17）**紅燈**：第 8 步 `resolve secret versions（釘具體版本，不用 :latest）` 以 exit code 1 失敗，其後 `gcloud auth configure-docker`／`migrate`／`docker build & push`／`gcloud run deploy ＋ verify`／`回填提示` 全數 `skipped`，`GITHUB_STEP_SUMMARY` 沒有寫入任何版本號。**上一節「離線驗證通過」不代表真實 run 會通過**——這正是本次事件要留下的教訓，故不覆蓋、直接在此追記事實，避免只留通過紀錄變成第二份真相。

**根因**：部署服務帳號 `github-deployer@pj002-509106.iam.gserviceaccount.com` 當時只有 `roles/artifactregistry.writer`／`roles/iam.serviceAccountUser`／`roles/run.admin`／`roles/secretmanager.secretAccessor` 四個角色。`gcloud secrets versions list` 需要 `secretmanager.versions.list` 權限，而 `roles/secretmanager.secretAccessor` 的 `includedPermissions` 只有 `resourcemanager.projects.get;resourcemanager.projects.list;secretmanager.versions.access`（只能「讀值」），`secretmanager.versions.list` 只在 `roles/secretmanager.viewer`。實查指令與輸出：

```bash
gcloud projects get-iam-policy pj002-509106 --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:github-deployer@pj002-509106.iam.gserviceaccount.com"
```
```text
ROLE
roles/artifactregistry.writer
roles/iam.serviceAccountUser
roles/run.admin
roles/secretmanager.secretAccessor
```
```bash
gcloud iam roles describe roles/secretmanager.secretAccessor --format="value(includedPermissions)"
gcloud iam roles describe roles/secretmanager.viewer         --format="value(includedPermissions)"
```
```text
resourcemanager.projects.get;resourcemanager.projects.list;secretmanager.versions.access

resourcemanager.projects.get;resourcemanager.projects.list;secretmanager.locations.get;secretmanager.locations.list;secretmanager.secrets.get;secretmanager.secrets.getIamPolicy;secretmanager.secrets.list;secretmanager.secrets.listEffectiveTags;secretmanager.secrets.listTagBindings;secretmanager.versions.get;secretmanager.versions.list
```

**教訓（給下一次寫離線驗證的人）：本機 gcloud 身分 ≠ CI 的 WIF 服務帳號身分，本機能列版本不代表 CI 能列。** r1 的本機實測（上一節「實測」段落）之所以顯示成功，是因為本機已登入的 `gcloud` 帳號是專案擁有者 `excalibur.star@gmail.com`，該帳號在專案層級預設具備近乎全權限；而真實 run 用的是 Workload Identity Federation 換來的短期憑證，身分是 `github-deployer@` 服務帳號，兩者的權限集合完全不同。**日後任何「需要新的雲端 API 呼叫」的 workflow 步驟，離線驗證只能證明語法與邏輯正確，不能替代「用實際會執行的服務帳號身分（或至少列出其角色與該角色的 includedPermissions，比對呼叫需要的權限）驗證」這一步**；本機指令成功的證據不得作為「CI 會成功」的結論依據。

**r2 修法**（本次落地，`.github/workflows/deploy-staging.yml` 與 `scripts/deploy-staging.sh` 的 `resolve_version()` 同步修正，維持三處一致）：不再讓 `gcloud secrets versions list` 的非 0 結束碼直接被 `set -e` 吞掉、只留下無意義的 `exit code 1`；改為顯式捕捉 stdout+stderr、失敗時輸出含 gcloud 原始訊息與修復指引（workflow 版：需 `roles/secretmanager.viewer`，或改填 `SECRET_VERSION_*` repository variable 略過查詢）的訊息（workflow 為 `::error::` annotation，本機腳本為一般 stderr）。IAM 授權本身（補上 `roles/secretmanager.viewer`）屬使用者的雲端專案安全設定，dev-ops 依安全鐵則不代為執行，已寫入 README「部署與 secrets」一節的步驟與備援路徑，待使用者執行後 `deploy-staging` 才會恢復綠燈。

---

### 6.10 事故紀錄：staging 流量自 09-19 回滾演練後釘死在 `todo-app-00003-lt2`（T-0045，2026-09-20）

#### 6.10.1 事故時間軸

| 時間（+08:00） | 事件 |
|---|---|
| 2026-09-19 16:33～16:34（T-0027 回滾演練，見 §5.4） | `scripts/rollback-staging.sh` 依 §5.1 執行「切到前一版 → 切回最新版」演練：`update-traffic --to-revisions todo-app-00002-sn7=100` → `update-traffic --to-revisions todo-app-00003-lt2=100`。**演練本身驗證通過**（兩次切流量皆 <11 秒、`/health` 皆 200），但**演練結束後未執行「還原為一律跟隨最新 revision」**。此時 `spec.traffic` 已從 `latestRevision: true` 變成明確釘定 `revisionName: todo-app-00003-lt2`，這是本次事故的根因起點，且完全發生在 T-0045 建卡之前——當時的回滾腳本（見本節 6.10.3）沒有「演練後歸位」的模式，也沒有任何提示 |
| 2026-09-19 16:49～2026-09-20 18:50（revision `00004-7p5` ～ `00016-tsg`，共 13 個） | 陸續由 T-0031（NFR-003 補強量測，含當時誤判為「0 秒不可用」的 `00008-kcs`，見下方影響範圍）、其餘維運與功能提交觸發部署，每個 revision 皆成功建立並通過 `/health` startup probe，`gcloud run deploy` 皆回報「deployed and is serving 100 percent of traffic」等表面成功訊息，**但 `spec.traffic` 仍明確釘定在 `todo-app-00003-lt2`，流量從未真正切過去** |
| 2026-09-20 20:10:31（`todo-app-00017-qg4`）、20:19:16（`todo-app-00018-xq4`） | T-0038（D-017 前端錯誤訊息時序競態修正）、T-0043（favicon 404 修正）合併 main 後觸發的部署（merge commit `d8a7427`／`1107bbd`，19:31 前後），以及其後 T-0039 IAM 授權複驗的空 commit（`854c843`，20:08:04）—— 同樣建立成功但未接流量。**revision `00004`～`00018` 共 15 個，涵蓋 T-0031、T-0039、T-0038、T-0043、v0.1.0 定版**，全數未曾服務過使用者 |
| 2026-09-20 20:41:17（Leader 發現，見 `tasks/E-001-todo-app.md`） | 使用者於 staging 重跑 D-017 驗證時，瀏覽器仍看到修正前的行為（`/favicon.ico` 404、時序競態訊息未消失）。Leader 實查 `gcloud run services describe` 確認 `spec.traffic: [{percent: 100, revisionName: todo-app-00003-lt2}]`、`status.latestCreatedRevisionName: todo-app-00018-xq4`，判定流量釘死；建 T-0045 並派工 dev-ops 立即處理 |
| 2026-09-20 20:44:51～20:48:10（T-0045 復原，本節 6.10.2） | dev-ops 背景量測 200 秒（每 1 秒一次）後執行 `update-traffic --to-latest`，152/152 樣本皆 200，最長連續非 200 秒數 = 0；復原後 `spec.traffic` 回到 `latestRevision: true`、100% 流量在 `todo-app-00018-xq4`（即 `status.latestCreatedRevisionName`） |

#### 6.10.2 影響範圍

- **staging 自 2026-09-19 16:33 起至 2026-09-20 20:44 復原為止（約 28 小時 11 分）持續服務 `todo-app-00003-lt2` 這一個舊映像**，其後合併的所有變更（T-0031 的量測探針環境變數、T-0039 secret 版本釘定與 verify 自動重試、T-0038 的 D-017 修正、T-0043 的 favicon 修正、v0.1.0 定版）**皆未曾真正上線**，即使對應的 `deploy-staging` run 全數顯示綠燈。
- **T-0031 §6.8.4「`00008-kcs` 部署期間 0 秒不可用」量測結果需重新解讀**：該次量測是對「已釘死流量」狀態下的一次新增部署做的 `/health` 輪詢，因為流量本來就沒有切向 `00008-kcs`，量測到的「0 秒不可用」只證明了「舊版本 `00003-lt2` 全程持續服務」，**不能作為「部署切流量不可用時間 < 60 秒」（TC-090／NFR-003）的有效證據**——它量到的其實是「沒有切流量」而非「切流量很快」。TC-090 需以本次事故復原後的真實部署重新量測（見 6.10.3 待補）。
- **T-0038（D-017 修正）、T-0043（favicon 修正）未上線**：qa-lead／使用者在 staging 觀察到的 D-017 間歇性錯誤訊息與 Edge `/favicon.ico` 404，在兩張卡「合併」之後仍會重現，因為使用者實際存取的是 `00003-lt2`（09-19 08:33 之前建置的映像），不含這兩張卡的程式碼變更。
- **不受影響的部分**：資料庫（Neon）與運算實例分離，回滾／釘死流量皆不觸碰資料，NFR-006 不受影響；`00003-lt2` 本身是 09-19 T-0027 驗證通過的「乾淨」版本（Basic Auth、`/health`、`/api/v1/todos` 皆正常），故服務本身在這 28 小時內**沒有對外呈現故障**，只是「一直是舊版本」，這也是本事故直到使用者實際重跑 D-017 驗證才被發現的原因——所有自動化 verify 只驗「服務有沒有回應」，不驗「回應的是不是本次部署的版本」。

#### 6.10.3 復原（實際指令與輸出）

先背景啟動量測（`scripts/measure-deploy-downtime.sh`，200 秒、1 秒一次），5 秒後執行復原指令：

```bash
GCLOUD="C:/Users/excal/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
MSYS_NO_PATHCONV=1 "$GCLOUD" run services describe todo-app --region asia-east1 --project pj002-509106 \
  --format="yaml(spec.traffic,status.traffic,status.latestReadyRevisionName,status.latestCreatedRevisionName)"
```

**復原前**：

```yaml
spec:
  traffic:
  - percent: 100
    revisionName: todo-app-00003-lt2
status:
  latestCreatedRevisionName: todo-app-00018-xq4
  latestReadyRevisionName: todo-app-00003-lt2
  traffic:
  - percent: 100
    revisionName: todo-app-00003-lt2
```

**關鍵發現（供 pipeline 修法判準用，dev-tl 初審 r1 核實並更正措辭）**：`status.latestReadyRevisionName` 在 Cloud Run 的實際行為中會跟隨「目前實際接流量的 revision」，而非單純「最近一次通過 Ready 條件的 revision」——`todo-app-00018-xq4` 的 `Ready` 條件實際在 `2026-09-20T12:19:16Z` 已為 `True`（以 `gcloud run revisions list` 逐一核對過所有 18 個 revision 皆 `Ready/True`），但流量釘死期間 `status.latestReadyRevisionName` 仍停在 `todo-app-00003-lt2`。**這個觀察屬實，但只能作為輔助佐證，不能單獨作為判準**：它是 Cloud Run 目前實作的未文件化行為（與 Knative 對該欄位的公開語義不同），且即使它等於新 revision，也無法排除「分流／canary」情境（例如流量 50/50）——這種情況下 `latestReadyRevisionName` 可能已等於新 revision，但新 revision 並未拿到 acceptance 要求的 100% 流量。**pipeline 修法的主判準改為直接讀 `status.traffic`，加總新 revision 拿到的百分比並要求等於 100**，`latestReadyRevisionName` 相等只作為併行的輔助條件（第 3.2 節、本卡新增即依此實作，見 6.10.4）。

```bash
MSYS_NO_PATHCONV=1 "$GCLOUD" run services update-traffic todo-app --region asia-east1 --project pj002-509106 --to-latest
```

```text
Updating traffic...
Routing traffic...........................................................................................done
Done.
URL: https://todo-app-dpevsdhdva-de.a.run.app
Traffic:
  100% LATEST (currently todo-app-00018-xq4)
```

**復原後**（立即重跑同一條 describe 指令）：

```yaml
spec:
  traffic:
  - latestRevision: true
    percent: 100
status:
  latestCreatedRevisionName: todo-app-00018-xq4
  latestReadyRevisionName: todo-app-00018-xq4
  traffic:
  - latestRevision: true
    percent: 100
    revisionName: todo-app-00018-xq4
```

`spec.traffic` 已回到 `latestRevision: true`（一律跟隨最新 revision），100% 流量在 `todo-app-00018-xq4`（即 `status.latestCreatedRevisionName`），`latestReadyRevisionName` 與 `latestCreatedRevisionName` 相等，確認流量已真正切過去。`curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://todo-app-dpevsdhdva-de.a.run.app/health` → `HTTP 200`。

**量測結果（`update-traffic --to-latest` 切流量期間，152 個樣本，每 ~1.3 秒一次，2026-09-20T12:44:51Z～12:48:10Z UTC）**：

```text
最長連續失敗次數（約秒數，取樣間隔 ~1s）：0
全程無非 200 回應。
```

```text
awk -F, 'NR>1{print $2}' <輸出檔> | sort | uniq -c
    152 200
```

**結論**：`update-traffic --to-latest` 本身是純服務層的流量切換操作（不重建、不重啟容器），復原過程對使用者完全無感，與 §5.1「數秒內生效、無需重新建置」的原理一致。此結果**不能取代** TC-090 對「一次完整 CI/CD 部署（含建置新映像、`gcloud run deploy` 建新 revision）」的不可用時間量測——兩者測的是不同操作；TC-090 重測留待下方「待補：真實部署重測」段落。

**待補：真實部署重測（TC-090）**——本節先以本次流量復原的量測結果佐證「切流量本身不影響可用性」，真實一次完整部署（新映像建置＋`gcloud run deploy`＋pipeline 新增的流量驗證）的 TC-090 重測，將由 Leader 協調根目錄合併排程後另行觸發並補上本段：

> （佔位：待 main 推送觸發 `deploy-staging` 真實 run 後，補上 run 連結／結論、`GITHUB_STEP_SUMMARY` 的「部署流量檢查」與 secret 版本表格、`scripts/measure-deploy-downtime.sh`（≥300 秒）量測的最長連續非 200 秒數）

#### 6.10.4 Pipeline 修法（本卡落地，落實 D-018）

**根因**：`gcloud run deploy` 在 `spec.traffic` 已被 `update-traffic --to-revisions <rev>=100` 明確釘定為某具名 revision 後，**不會自動把流量切到新部署的 revision**——這與「新 revision 通過 startup probe 才切流量」（§3.2、§5.1 的既有原理）是两回事：後者是「切不切」的問題（新 revision 健康與否），前者是「切去哪」的問題（`spec.traffic` 有沒有在追蹤 latest）。deploy-staging 的 `verify_health`／`verify_auth` 只呼叫 `status.url`（同一個網址不論流量指到哪個 revision 都會回應同一個結果），因此這個問題對現有 pipeline **完全不可見**，才會出現「15 次全綠但一次都沒真的上線」的狀況（qa-lead r4 立 D-018，S2 等級：驗證失效）。

**修法（`.github/workflows/deploy-staging.yml`、`scripts/deploy-staging.sh` 同步；dev-tl 初審 r1 退回後修正判準）**：`gcloud run deploy` 之後，新增流量驗證：主判準為直接讀 `status.traffic`（`csv[no-heading]` 格式解析為 `revision,percent`），加總本次剛部署的 revision 拿到的百分比，要求等於 **100**；`status.latestReadyRevisionName` 是否等於該 revision 併作輔助佐證條件（見 6.10.3「關鍵發現」，此欄位在 Cloud Run 實際跟隨接流量的 revision，但屬平台未文件化行為，不單獨作為判準——只看它會漏判分流／canary 情境）。兩個條件皆成立才視為通過，寫入 `$GITHUB_STEP_SUMMARY`（本機腳本印到 stdout）「新 revision 名稱、`status.traffic` 實際讀到的流量百分比」；未通過則自動執行一次 `gcloud run services update-traffic <service> --region <region> --to-latest`（等同本次的復原動作）並重新輪詢 `/health`、重新驗證，仍未通過才印 `::error::` 判紅（本機腳本則以非 0 結束並輸出目前流量分佈供人工判讀）。此檢查置於既有的 `verify_health` 之後、`verify_auth`（帶憑證，含既有的 T-0039 自動重試一次邏輯）之前，兩次部署嘗試（第 1 次與 verify_auth 失敗後的自動重試）皆各自跑一次流量驗證，避免只補到一半。

**`scripts/rollback-staging.sh` 新增 `--to-latest` 模式**：`bash scripts/rollback-staging.sh --to-latest` 把流量還原為「一律跟隨最新 revision」，等同本次事故復原的動作；不帶參數列出清單，帶 revision 名稱參數執行既有的 `--to-revisions` 釘定回滾（保留原行為，但檔頭新增警語「回滾後之後的 deploy 不會自動切流量，演練結束或修好後必須 `--to-latest` 還原」，執行後的輸出也會即時印出同樣的提醒）。README「部署與 secrets」章節同步這段警語與三種用法。

**離線驗證**（`bash -n`、`actionlint`、YAML lint；`gcloud` 相關的線上驗證已於本節 6.10.3 以本機已登入之 owner 帳號 `excalibur.star@gmail.com` 對三個檔案的邏輯逐條實測，但依 §6.9.1 的教訓，**CI 用的是 WIF 服務帳號 `github-deployer@`，兩者權限不同，離線驗證不能證明 CI 一定會通過**，仍待 6.10.3「待補」段落的真實部署補證）：

```bash
actionlint.exe -color .github/workflows/deploy-staging.yml .github/workflows/ci.yml .github/workflows/monitor-health.yml
```
```text
（無輸出，EXIT=0，零 finding）
```

```bash
npx --yes yaml-lint .github/workflows/deploy-staging.yml .github/workflows/ci.yml .github/workflows/monitor-health.yml infra/cloudrun-service.yaml
```
```text
√ YAML Lint successful.
```

```bash
bash -n scripts/deploy-staging.sh scripts/rollback-staging.sh
```
```text
（無輸出，EXIT=0，語法正確）
```

**已離線重跑 `scripts/rollback-staging.sh --to-latest`（真實 gcloud、非 dry-run，本機已登入帳號）驗證新增模式可用**：輸出見 6.10.3 用法一致的 `services describe` 結果（`spec.traffic latestRevision: true, percent: 100`、`/health` 200），因流量本來就已在 `todo-app-00018-xq4`，此次執行為冪等重跑，未產生新的流量變化，僅用以證明 `--to-latest` 模式本身可正確執行；`STAGING_BASIC_AUTH_USER`／`STAGING_BASIC_AUTH_PASSWORD` 未匯出，故驗證 2/3（帶憑證）如預期被跳過，符合「不讀取、不輸出 secret 值」的環境限制。

**給 qa-lead 的重驗清單（哪些 staging 結論仍有效／哪些需重驗）**：

| 項目 | 狀態 | 說明 |
|---|---|---|
| TC-090（部署不可用時間 < 60 秒） | **需重驗** | 舊結果（T-0031 §6.8.4「0 秒」）量測的是流量已釘死狀態下的部署，未測到真正切流量；本次流量復原量測（152/152、0 秒）只驗證了切流量操作本身，非完整部署流程。需待 6.10.3「待補」段落的真實部署重測 |
| TC-080（`/api/v1/todos` 資料筆數直接比對） | **需重驗** | 因流量長期指向 `00003-lt2`，先前任何在此期間對 staging 做的資料筆數比對，比對到的都是同一個舊版本的資料層行為，與新版程式碼（T-0038／T-0043 等）無關；需在流量已確認指向最新 revision 後重新執行 TC-080 原始步驟 |
| D-017（前端錯誤訊息時序競態，T-0038 修正） | **需重驗** | 使用者於 09-20 20:41 重跑時看到的正是修正前行為，因為當時仍服務 `00003-lt2`；流量已於 20:44 復原到 `00018-xq4`（已含 T-0038 修正），請於流量復原後的網址重新驗證 |
| TC-009 favicon（T-0043 修正） | **需重驗** | 同上，`00003-lt2` 不含 `public/favicon.ico`；流量復原後應可在 Edge／Chromium 重新確認 404 已消失 |
| P0 功能與 NFR-003（在 `00003-lt2` 上跑的既有測試，例如 T-0027 首次部署驗證、Cloud Monitoring uptime check 24 小時採樣） | **仍然有效** | `00003-lt2` 本身是 09-19 T-0027 驗證通過的乾淨版本（Basic Auth、`/health`、`/api/v1/todos` 皆正常），這段期間 uptime check 量到的「服務存活」是真實的（服務確實一直在回應，只是版本沒更新），不受本次事故影響；NFR-003 的 24 小時採樣起算與判讀邏輯不需重跑 |
| 回滾程序本身（06 §5.1／§5.4 演練紀錄） | **仍然有效，但需認知演練有後遺症** | 演練當下的切流量與驗證步驟本身完全正確（10 秒內完成、`/health` 皆 200），問題出在「演練後未還原」這個操作習慣，不是回滾機制本身有缺陷。README／腳本已補上警語與 `--to-latest` 模式，往後演練需依新流程收尾 |

事故報告全文另見 `docs/reports/20260920-2042-流量釘死事故-E001.md`。

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
| 機密（Secret Manager 參照）<br>**T-0039 實作／T-0040 規格同步：一律釘具體版本，不得用 `:latest`** | `secretKeyRef`：`DATABASE_URL←database-url`、`BASIC_AUTH_USER←basic-auth-user`、`BASIC_AUTH_PASSWORD←basic-auth-pass`，三者的 `key` 皆為佔位符 **`"<SECRET_VERSION>"`**（本檔為文件化 IaC、非自動套用；手動 `services replace` 前須先以 `gcloud secrets versions list` 查出版本號逐一替換，檔內已附註解與指令） | `resolve secret versions` 階段查出 `${DB_VERSION}`／`${USER_VERSION}`／`${PASS_VERSION}` 後組出 `--set-secrets "DATABASE_URL=database-url:${DB_VERSION},BASIC_AUTH_USER=basic-auth-user:${USER_VERSION},BASIC_AUTH_PASSWORD=basic-auth-pass:${PASS_VERSION}"`；版本號寫入 `$GITHUB_STEP_SUMMARY`；可由 repository variables `SECRET_VERSION_*` 覆寫 | 同左：`resolve_version()` 函式邏輯逐字相同，覆寫用環境變數同名（`SECRET_VERSION_DATABASE_URL`／`SECRET_VERSION_BASIC_AUTH_USER`／`SECRET_VERSION_BASIC_AUTH_PASS`） | **一致（語意層面）**：三處皆為「具體版本號」而非 `:latest`。差異僅在**版本號的取得時機**——workflow 與腳本在執行時自動查、IaC 檔留佔位符由人套用前替換；這是「自動部署」與「文件化 IaC」的本質差別，不是飄移。查版本號需 `roles/secretmanager.viewer`（§2.1 第 5 項） |
| ingress／未驗證存取 | `annotations: run.googleapis.com/ingress: all`（僅控制入口來源，**不等同 IAM 的 `roles/run.invoker` 綁定**） | `--allow-unauthenticated`（gcloud 會同時綁 `allUsers` 的 `roles/run.invoker`） | `--allow-unauthenticated`（同左） | **飄移**：套用 IaC 檔（`gcloud run services replace`）不會自動把服務設為允許未驗證呼叫；日常自動部署走 `deploy-staging.yml`／`deploy-staging.sh` 的 `gcloud run deploy`，皆帶 `--allow-unauthenticated`，故實際服務狀態一致；但若有人改用 `services replace` 手動套用 IaC 檔，需另外執行一次 `gcloud run services add-iam-policy-binding <service> --member=allUsers --role=roles/run.invoker`，否則平台層會擋在應用層 Basic Auth 之前 |
| startup／liveness probe | `startupProbe`（`GET /health`，`initialDelaySeconds: 0`、`periodSeconds: 5`、`timeoutSeconds: 3`、`failureThreshold: 3`）＋ `livenessProbe`（同路徑，`periodSeconds: 30`、`timeoutSeconds: 3`、`failureThreshold: 3`） | 無對應 `gcloud run deploy` flag（`gcloud` 目前不支援以旗標設定自訂 probe；套用 `gcloud run deploy` 時 Cloud Run 使用平台預設探測） | 同左（無對應 flag） | **飄移（已知，ADR-0005 授權 dev-ops 決定去留的取捨之一）**：探測設定**只存在於 IaC 檔**。日常部署路徑（`gcloud run deploy`）目前吃 Cloud Run 平台預設的啟動探測（對容器埠打 TCP 或依映像宣告），並非本檔宣告的 `/health` HTTP 探測。若要讓 `/health` 探測實際生效，須改用 `gcloud run services replace infra/cloudrun-service.yaml`（並先手動代入 `<GCP_PROJECT_ID>`／`<IMAGE_TAG>`）取代 `gcloud run deploy`，或等 `gcloud run deploy` 支援對應旗標後再收斂為單一事實來源。此項為既有已知落差，本卡未變更任何一處部署邏輯，僅在此列表存查 |
| 服務帳號執行身分 | 不宣告（由映像的 `USER appuser` 決定，非 root），本檔亦不重複宣告 | 同左（不由 `gcloud run deploy` 指定容器內執行身分） | 同左 | 一致（皆委由 Dockerfile） |

**維護規則**：日後任何人變更上表任一參數，須同時檢查其餘兩處是否需要跟進；若刻意留下差異（例如 probe 一項），須在本表「現況」欄註明理由與影響範圍，不得無聲飄移。**第四處要一起檢查的是本文件**——T-0039 改了三處程式、T-0040 才補上規格文字，中間留了一段「文件與事實不符」的窗，這是本表要避免的同一類問題。

---

## 變更紀錄

| 日期 | version | 任務卡 | 變更摘要 |
|---|---|---|---|
| 2026-09-19 | 0.1 | T-0004 | 初版。平台為 Render Web Service（Free）＋ Neon Free，Gate 1 通過後凍結 |
| 2026-09-19 | **0.2** | **T-0010**（規格變更請求，使用者裁決、Leader 核准） | **雲端平台改為 GCP Cloud Run（`min-instances = 0`）＋ Artifact Registry**，資料庫維持 Neon Free。改動範圍：第 1 章 staging 網址改為 `*.run.app`（由 dev-ops 部署後填入）；第 2 章資源清單全面改寫（Cloud Run／Artifact Registry／WIF／明確否決 Cloud Scheduler）；第 3 章 pipeline 改為 build → push Artifact Registry → `gcloud run deploy`，新增 3.2.1 WIF 認證與 3.2.2 服務帳號金鑰備選；第 4 章環境變數移除 Render 專屬項、新增 GCP 專屬項；第 5.1 節回滾首選改為 `gcloud run services update-traffic` 切 revision；第 6 章監控加入 Cloud Run 內建指標、冷啟說明由 30–50 秒改為 1–3 秒。決策紀錄見 `adr/ADR-0005-雲端平台-CloudRun.md`（`ADR-0003` 已標 superseded）。**status 維持 `frozen`**，後續變更仍須走規格變更請求任務卡 |
| 2026-09-19 | 0.2（實作紀錄，未變更版本號） | **T-0031**（維運補強，Leader 裁決 B／C 核准，非規格變更） | 第 6 章新增 6.8 節：GitHub cron 排程長期零自動觸發之診斷（結論：無可修設定缺陷，判斷為 GitHub 排程延遲）；新增 Cloud Monitoring uptime check（`todo-app-health`，check id `todo-app-health-aMAlP5dfKv0`）作為 NFR-003 **主要**來源，`monitor-health.yml` 降為**備援**；6.1 表格與 6.2 採樣起算時間同步更新（改以 uptime check 建立時間 2026-09-19T17:55:07+08:00 為準）；補充判讀指令（`timeSeries.list`）首次實跑輸出；補做 TC-080／TC-090 的 `/health` 直接量測（0 秒不可用）。僅屬 dev-ops 實作紀錄補寫，不涉及架構或流程決策變更，version 號不更動 |
| 2026-09-20 | 0.3（實作紀錄與事故補救，未變更版本號） | **T-0045**（維運事故，Leader 2026-09-20T20:41:17 裁決；dev-tl 初審 r1 退回 R-1／R-2 後修正） | 第 6 章新增 6.10 節：staging 流量自 09-19 回滾演練後釘死在 `todo-app-00003-lt2`（15 個新 revision 從未接流量）之事故時間軸、影響範圍、復原（`update-traffic --to-latest`，152/152 樣本 0 秒不可用）、pipeline 修法（deploy 後主判準改讀 `status.traffic` 加總新 revision 拿到的百分比並要求等於 100，`latestReadyRevisionName` 相等併作輔助佐證，未達 100% 自動 `update-traffic --to-latest` 並重驗，仍未達才判紅）、給 qa-lead 的重驗清單。同步修改 `.github/workflows/deploy-staging.yml`、`scripts/deploy-staging.sh`、`scripts/rollback-staging.sh`（新增 `--to-latest` 還原模式與警語）、`README.md`。**僅屬 dev-ops 事故紀錄與 pipeline 補強，不涉及架構決策變更，version 號不更動；§5.1 規格文字本身的修正（例如補述「演練後須還原」的正式流程文字）留待 P1 規格同步卡由 plan-sd 處理** |
| 2026-09-20 | **0.3** | **T-0040**（規格變更請求，Leader 2026-09-20T18:18:13 裁決 C 選項 1 ＋ D-016 ＋ T-0039 實作同步，另含 Leader 派工時追加兩項） | **三項主變更＋兩項追加**：①**`monitor-health.yml` 定位**由「NFR-003 的備援來源」改為「**保溫與人工抽查用，不具備援能力**」（§3.3 標題與全節、§6.1 前言與表格第 2 列、§6.3 告警條補「此告警機制實質已失效」更正）。依據：T-0037 24 小時窗實測 `event=schedule` **8 次／理論約 258 次（約 3%）**，8 次皆 success，成因為 GitHub 平台排程延遲、無可修設定缺陷（§6.8.1）。NFR-003 主要且唯一量測來源明寫 Cloud Monitoring uptime check `todo-app-health`。**另於 §6.1 新增「備援缺口」小節**，列出「新增第二個 uptime check／定期人工核對／接受單點」三選項與各自代價（免費額度、告警重複），**交 Leader 裁決，本卡不自行決定**。②**secret 參照由 `:latest` 改為版本釘定**（§3.2 新增 `resolve secret versions` 階段列、deploy 與 verify 合併為單一步驟並含一次自動重試、新增「為什麼 secret 參照要釘具體版本」、§4.1 註改寫、§4.2 補三個 `SECRET_VERSION_*` repository variables、**§7 參數表「機密（Secret Manager 參照）」列改寫**），與 T-0039 的 main 現況一致。③**HTTPS 導向判準**：§2 資源表「Google 前端 301 導向 HTTPS」改為「**3xx（實測 302 Found）**，判準為『回 3xx 且 `Location` 為對應的 `https://` 網址』」（D-016、Leader 2026-09-19T17:30:10 裁決①）。④**（Leader 追加）§2 新增 2.1 節「部署服務帳號角色清單」**：由三個角色補列為**五個**，逐項寫明用途與「少了會怎樣」，新增的 `roles/secretmanager.viewer` 對應 `secretmanager.versions.list`（§6.9.1 真實紅燈 run `35506278351` 的根因），並附授權與核對指令、「既有專案要補跑一次」說明；§3.2.1 六步設定與 §4.1 註同步指向 §2.1。⑤**（Leader 追加）§7 三處參數同步表**同④之②。**未改動**：`01_需求規格書_SRS.md`（實查無「301」字面，原文即寫「觀察 3xx 導向」）、`20_測試案例.md` TC-079 判準（依任務卡由 qa-lead 於下一輪測試計畫同步卡處理）、`03_系統設計書_SD.md` §7 NFR-002①（非本卡 outputs，已列交接檔下一步建議）。**status 維持 `frozen`** |
