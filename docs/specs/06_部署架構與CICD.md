---
doc: DEPLOY
title: 部署架構與 CI/CD
epic: E-001
version: 0.1
status: frozen         # Gate 1 通過 2026-09-19，變更走「規格變更請求」任務卡
author: plan-sd        # 設計階段由 plan-sd 起草；開發階段由 dev-ops 補實作細節
reviewers: [dev-tl, dev-ops]
updated: 2026-09-19T06:03:40+08:00
---

# 部署架構與 CI/CD：E-001 待辦事項 Web 應用

平台：**Render Web Service（Docker runtime，Free 方案）＋ Neon Serverless Postgres（Free 方案）**，CI/CD 為 **GitHub Actions**（Epic 指定）。選型理由與被淘汰的選項見 `adr/ADR-0003-雲端平台.md`；認證與同源部署的取捨見 `adr/ADR-0004-認證與同源部署.md`。

**本文件不含任何憑證值。** Epic 限制明載「憑證與雲端帳號由使用者提供，agent 不得索取或代填」。第 4 章只列環境變數的**名稱與用途**。

---

## 1. 環境清單

| 環境 | 用途 | 網址 | 誰可部署 | 資料 |
|---|---|---|---|---|
| dev | 本機開發與離線驗證 | `http://localhost:8080` | 任何人（`docker compose up`） | 本機 `postgres:16-alpine` 容器，假資料，可任意清空 |
| staging | 驗收者 UAT（UC-010）、測試團隊驗證、NFR 量測 | `https://<service>.onrender.com`（實際名稱由使用者建立服務時決定） | CI 自動（`main` 綠燈後觸發） | Neon Free Postgres，測試資料。P0 無真實個資；P1 導入時一次性 `TRUNCATE`（BR-032） |
| prod | **本 Epic 不建立** | — | — | — |

**為什麼沒有 prod**：Epic 的成功指標只到 Gate 2「staging 可用瀏覽器操作、P0 UAT 全通過」。建立 prod 屬擴大範圍。本文件的 pipeline 保留一個手動觸發的 `deploy-prod` 位置（第 3 章），但**本輪不實作、不設定**。

**本機與 staging 的一致性**：兩者都以**同一份 `Dockerfile`** 建置、都連 PostgreSQL 16。因此 `docker build` 在本機成功，已經驗掉雲端建置的絕大部分失敗原因 —— 這是 Epic「可離線驗證」限制的落實方式。

---

## 2. 雲端資源清單（依 ADR-0003）

| 資源 | 規格 | 用途 | 費用估計 |
|---|---|---|---|
| Render Web Service | Free 方案、Docker runtime、512 MB RAM、0.1 CPU、單一區域（Singapore 或 Oregon，由使用者選）、health check path = `/health` | **單一**對外服務，同時供應單頁前端（`public/`）與 REST API（`/api/v1/*`）。同源部署（Leader 裁決 O-004） | **US$0**。Free 方案不需信用卡 |
| Render 自動 TLS 憑證 | `*.onrender.com` 平台憑證，自動更新，HTTP 自動 301 導向 HTTPS | AC-010-2、BR-025、NFR-002① —— **由平台滿足，團隊零程式碼** | US$0（含於上） |
| Neon Serverless Postgres | Free 方案、PostgreSQL 16、0.5 GB 儲存、閒置自動暫停 | `todos`、（P1）`users` 的持久化。**與運算實例分離**，重新部署不觸碰資料（NFR-006、AC-010-3） | **US$0**。免費方案無到期日 |
| GitHub Actions | 公開倉庫免費；私有倉庫每月 2000 分鐘免費額度 | CI（lint／unit／build／integration）、部署觸發、每 5 分鐘健康監測 | US$0（本專案用量遠低於額度：CI 每次約 3 分鐘，監測每次約 1 分鐘 × 288 次／日 ≈ 需注意私有倉庫額度，見下） |

**合計經常性費用：US$0。**

**GitHub Actions 額度的注意事項**：若倉庫為**私有**，每 5 分鐘一次的監測工作流會消耗約 288 分鐘／日，一個月即超出 2000 分鐘的免費額度。對策二選一（由 dev-ops 於開卡時擇一，並記錄在該卡）：

1. **倉庫設為公開**（本專案為框架試跑範例，無機密內容 —— 憑證一律在 secrets，不在程式碼中），公開倉庫的 Actions 分鐘數不計費。**建議採此項。**
2. 若必須私有，則把監測改為每 10 分鐘一次，並把 NFR-003 的取樣分母同步調整。注意：10 分鐘仍 < Render Free 的 15 分鐘休眠門檻，保溫效果不受影響。

---

## 3. Pipeline 階段（GitHub Actions）

三個工作流檔案：`ci.yml`（OPS-02）、`deploy-staging.yml`（OPS-03）、`monitor-health.yml`（OPS-04）。

### 3.1 `ci.yml` — PR 與 push to main

| 階段 | 觸發 | 做什麼 | 失敗時 |
|---|---|---|---|
| lint | PR / push main | `npm ci` → `npm run lint`（ESLint ＋ `tsc --noEmit`）→ `npx @redocly/cli lint docs/specs/04_API規格.yaml`。**API 規格一起 lint**，避免規格與實作漂移 | 阻擋合併 |
| unit | PR / push main | `node --test tests/unit/` —— `todo-service` 的 32 條 BR 逐條測試（不需資料庫） | 阻擋合併 |
| build | PR / push main | `docker build -t todo-app:${{ github.sha }} .`。**與 Render 用同一份 Dockerfile**，本階段綠燈即代表雲端建置幾乎必然成功 | 阻擋合併 |
| integration | PR / push main | 以 GitHub Actions 的 service container 起 `postgres:16-alpine`，跑 migration 後執行 `node --test tests/integration/`：端點狀態碼、統一錯誤結構、**Basic Auth 三情境（帶對憑證 200／不帶 401／`/health` 無憑證 200）** | 阻擋合併與部署 |

### 3.2 `deploy-staging.yml` — main 綠燈後

| 階段 | 觸發 | 做什麼 | 失敗時 |
|---|---|---|---|
| migrate | `ci.yml` 於 `main` 全綠 | 以 `NEON_DATABASE_URL` 執行 `npm run migrate`（forward-only，單一交易逐檔套用） | **中止部署**，不觸發 Render；前一版服務維持可用。通知 dev-ops |
| deploy | migrate 成功 | `curl -fsS "$RENDER_DEPLOY_HOOK_URL"` 觸發 Render 部署。Render 端流程：拉 git → `docker build` → 啟動新實例 → **輪詢 `/health` 通過才切流量** → 關閉舊實例（零停機） | Render 自動保留舊實例，服務不中斷。通知 dev-ops |
| verify | deploy 觸發後 | 輪詢 `https://<staging>/health` 直到回 200（每 10 秒一次，**上限 10 分鐘**）；再以 secrets 中的 Basic Auth 憑證呼叫 `GET /api/v1/todos` 確認回 200（確認認證與資料庫皆正常） | 逾時即工作流失敗並通知 dev-ops；**服務仍在舊版本，不需人工回滾** |
| deploy-prod | **手動（本輪不實作）** | 保留位置。本 Epic 無 prod 環境 | — |

**為什麼 migrate 在 deploy 之前**：forward-only 的 migration 一律是「加欄位／加表／加索引」，對舊版程式碼是相容的（expand-contract 的 expand 階段）。先 migrate 再 deploy，可確保新程式碼啟動時 schema 已就緒；即使部署失敗，舊程式碼在新 schema 上仍能運作。

### 3.3 `monitor-health.yml` — NFR-003 的量測與保溫

| 階段 | 觸發 | 做什麼 | 失敗時 |
|---|---|---|---|
| sample | `schedule: cron "*/5 * * * *"` ＋ `workflow_dispatch` | **連續取樣 3 次，間隔 20 秒**，`curl -fsS -o /dev/null -w "%{http_code} %{time_total}" https://<staging>/health`（**不帶任何憑證** —— `/health` 是唯一未保護路徑）。結果 append 進 artifact | 記錄失敗次數，**工作流本身不標紅**（單次失敗是資料而非事故），連續 3 次全失敗才以 `::error::` 標記 |

設計說明：

- **為何每次取樣 3 次**：GitHub 的 `schedule` 觸發在尖峰時段可能延遲數分鐘。單次取樣遇到延遲會產生資料空洞；連續 3 次取樣讓單一排程延遲不至於造成整段漏測。NFR-003 的成功率**以實際取樣次數為分母**，不以理論次數（2016 次／7 日）為分母。
- **監測即保溫**：5 分鐘 < Render Free 的 15 分鐘休眠門檻，因此監測本身使服務保持喚醒（ADR-0003）。這不是巧合，是把量測手段同時當作可用性手段。
- **不帶憑證是刻意的**：若監測帶 Basic Auth 憑證，就等於沒有驗證 BR-017 的豁免是否真的生效。**不帶憑證仍得 200，才證明豁免正確**。

---

## 4. 環境變數清單（只列名稱與用途，值不入版控）

**本章不含任何值。** 使用者於 Render 服務設定頁與 GitHub repository secrets 中自行填入。`.env.example` 與 `infra/render.yaml` 同樣只含名稱（`render.yaml` 的每個變數一律標 `sync: false`，代表由使用者在平台上填）。

### 4.1 應用執行期（Render 服務設定 ／ 本機 `.env`）

| 名稱 | 用途 | 環境 | 來源（secrets 管理） |
|---|---|---|---|
| `NODE_ENV` | `production` / `development`。影響日誌格式與錯誤詳細度 | dev, staging | render.yaml 明文（非機密） |
| `PORT` | 服務監聽埠。Render 會自行注入；本機預設 8080 | dev, staging | Render 自動注入／本機 `.env` |
| `DATABASE_URL` | **機密**。Neon PostgreSQL 連線字串（含密碼）。本機為 compose 內的 Postgres | dev, staging | Render 服務設定（`sync: false`）／本機 `.env` |
| `BASIC_AUTH_USER` | **機密**。P0 全站共享帳號（BR-016、Q-008） | staging（本機可選） | Render 服務設定（`sync: false`） |
| `BASIC_AUTH_PASSWORD` | **機密**。P0 全站共享密碼。**倉庫中不得出現任何值，違反即阻擋級安全缺陷** | staging（本機可選） | Render 服務設定（`sync: false`） |
| `LOG_LEVEL` | pino 等級（`info` / `debug` / `warn`）。staging 預設 `info` | dev, staging | render.yaml 明文（非機密） |
| `CORS_ALLOWED_ORIGINS` | 具名的允許來源，逗號分隔。**預設留空 ＝ 同源部署，完全不註冊 CORS 外掛**（Leader 裁決 O-004、BR-015）。**永遠不得填入 `*`** | staging | render.yaml 明文（預設空字串） |
| `JWT_SECRET` (P1) | **機密**。JWT 簽章金鑰 | staging | Render 服務設定（`sync: false`） |
| `JWT_EXPIRES_IN` (P1) | access token 有效期，固定 `24h`（BR-021、Q-010）。**無 refresh token** | staging | render.yaml 明文（非機密） |
| `BCRYPT_COST` (P1) | bcrypt 成本因子，預設 `12`（BR-018 要求 ≥ 10） | staging | render.yaml 明文（非機密） |

### 4.2 CI/CD（GitHub repository secrets ／ variables）

| 名稱 | 用途 | 環境 | 來源 |
|---|---|---|---|
| `RENDER_DEPLOY_HOOK_URL` | **機密**。Render 提供的部署觸發網址（本身即含 token） | GitHub Actions | GitHub repository secrets |
| `NEON_DATABASE_URL` | **機密**。CI 的 migrate 階段使用的連線字串（可與應用同一條） | GitHub Actions | GitHub repository secrets |
| `STAGING_BASE_URL` | staging 的基底網址（**非機密**，可用 repository variables） | GitHub Actions | GitHub repository variables |
| `STAGING_BASIC_AUTH_USER` | **機密**。verify 階段呼叫受保護端點用 | GitHub Actions | GitHub repository secrets |
| `STAGING_BASIC_AUTH_PASSWORD` | **機密**。同上 | GitHub Actions | GitHub repository secrets |

**使用者一次性設定清單（交付 README 須逐項列出）**：Render 帳號 → 建立 Web Service（Docker，指向本倉庫）→ 填 4.1 的機密變數 → 複製 Deploy Hook URL；Neon 帳號 → 建立專案 → 複製連線字串；GitHub → 填入 4.2 的 secrets。**全程不需信用卡；agent 不索取、不代填。**

**禁止事項**：`.env` 必須列入 `.gitignore`；任何憑證值不得出現在程式碼、`render.yaml`、工作流檔、測試 fixture 或文件中；pino 設 `redact: ["req.headers.authorization"]` 確保 Basic Auth 標頭不落日誌。

---

## 5. 回滾程序（必須實際演練過一次，記錄日期與結果）

**前提**：migration 為 **forward-only**（ADR-0002、`05_資料庫設計.md` 第 3 章），且一律為相容變更（加欄位／加表／加索引）。因此**回滾程式碼不需要回滾資料庫** —— 舊版程式碼在新 schema 上仍能運作。這是刻意的設計：免費方案沒有可靠的時間點還原，能回滾的東西反而更容易在慌亂中把資料弄丟。

### 5.1 首選：平台層即時回滾（目標 < 2 分鐘）

1. 於 Render Dashboard 開啟該服務的 **Events / Deploys** 列表。
2. 找到最後一次已知良好的部署，點 **Rollback to this deploy**（Render 保留先前建置的映像，不需重新建置）。
3. 等待新實例通過 `/health` 檢查並切換流量（零停機輪替，不可用時間應 < 60 秒，符合 NFR-003）。
4. 驗證：
   - `curl -fsS https://<staging>/health` → `200 {"status":"ok"}`
   - `curl -fsS -u "$USER:$PASS" https://<staging>/api/v1/todos` → `200` 且資料筆數與回滾前一致（驗證 NFR-006：回滾不影響資料）。
5. 於 `docs/reports/` 或缺陷單記錄：回滾時間、回滾到的 commit SHA、觸發原因。

### 5.2 備選：以 git 回復並重新部署（目標 < 10 分鐘）

當平台層回滾不可用（例如舊映像已被清理），或需要把 `main` 的內容一併修正時：

1. `git revert <bad-commit-sha>`（**用 revert 不用 reset**：`main` 受保護且已推送，reset 會改寫他人已拉取的歷史）。
2. 開 PR → CI 四階段全綠 → 由 dev-tl 合併到 `main`。
3. `deploy-staging.yml` 自動觸發；verify 階段輪詢 `/health` 至 200。
4. 同 5.1 第 4 步驗證。

### 5.3 資料庫層（僅在 migration 本身有誤時）

1. **不執行任何 `DROP`／`down` migration。**
2. 撰寫一個**新的**前進式 migration（例如 `003_fix_....sql`）修正錯誤，走 5.2 的流程部署。
3. 僅當資料已遭破壞且無法以前進式修正時，才使用 Neon 的時間點還原（Free 方案的保留窗較短），並於升級單中記錄。此路徑**不納入本設計的可用性保證**。

### 5.4 演練要求

- 演練紀錄：yyyy-mm-dd，結果：**尚未演練。**
- **本演練是 Gate 2 的前置條件**，由 **dev-ops** 於 DevOps ② 卡（OPS-03）完成後執行一次 5.1 流程並回填上行。演練內容：刻意部署一個會啟動失敗的版本 → 確認 Render 因 `/health` 不通過而**不切換流量**（服務維持舊版可用）→ 再執行一次 5.1 的平台層回滾 → 記錄不可用時間與資料筆數比對結果。

---

## 6. 監控與告警

### 6.1 監控項目

| 項目 | 方式 | 門檻 | 對應 |
|---|---|---|---|
| 服務存活 | `monitor-health.yml` 每 5 分鐘取樣 3 次 `GET /health`（**不帶憑證**） | 成功率 ≥ 99% | NFR-003、AC-010-5、UC-011 |
| 部署中斷時長 | 部署期間以每 5 秒一次輪詢記錄連續失敗時長 | < 60 秒 | NFR-003 |
| 回應時間 | 上述 `curl` 的 `%{time_total}` 一併記錄 | 觀察用，正式門檻以 NFR-001 的負載測試為準 | NFR-001 |
| 5xx 事件 | Render Logs 中 pino 的 `level: 50` 記錄，含 `reqId` | 出現即查 | NFR-005、BR-014 |
| 資料庫容量 | **不監控**。500 筆上限約 125 KB，Neon Free 為 0.5 GB，餘裕約 1000 倍 | — | NFR-007 |

### 6.2 採樣期（Leader 裁決 O-009）

- **Gate 2 的門檻：連續 24 小時採樣，每 5 分鐘一次，成功率 ≥ 99%。**
- 連續 7 天為**正式環境的目標**，不作為 Gate 2 的門檻（時程不允許）。
- plan-ba 於 T-0005 把 SRS 的 NFR-003 量測方式改寫為「Gate 2：24 小時；正式：7 天」。

### 6.3 告警與已知誤報

- 告警方式：`monitor-health.yml` 在**連續 3 次取樣全部失敗**時以 `::error::` 標記工作流，GitHub 自動寄信給倉庫關注者。**不引入第三方告警服務**（避免額外帳號與憑證，符合 Epic 限制）。
- **已知誤報來源 —— Render Free 的冷啟**（ADR-0003 明確承擔的殘留風險）：
  - 若監測工作流本身失效超過 15 分鐘，服務會進入休眠；下一次請求會遇到 30–50 秒冷啟，該次取樣可能逾時而被記為失敗。
  - **判讀規則**：NFR-003 未達標時，**須先區分是應用缺陷還是平台休眠／平台事件**，再決定是否升級方案。判讀依據為 Render 的 Events 紀錄與該時段的取樣間隔是否異常拉長。
  - 此判讀規則同步寫入 `03_系統設計書_SD.md` 第 7 章 NFR-003。
- **NFR-001 的量測不受此誤報影響**：負載測試腳本規定**先暖身 10 秒再開始取樣**，排除冷啟與喚醒的離群值（SD 第 7 章 NFR-001）。
