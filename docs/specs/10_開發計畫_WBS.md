---
doc: WBS
title: 開發計畫
epic: E-001
version: 0.3
status: review
author: dev-tl
reviewers: [leader]
updated: 2026-09-19T08:26:00+08:00
---

# 開發計畫（WBS）：E-001 待辦事項 Web 應用

輸入：規格包 `01_需求規格書_SRS.md`／`02_系統分析書_SA.md`／`03_系統設計書_SD.md`／`04_API規格.yaml`／`05_資料庫設計.md`／`06_部署架構與CICD.md`／`adr/ADR-0001~0004`／`traceability.md`（Gate 1 通過 2026-09-19，全部凍結）。

> **變更通知（2026-09-19，使用者裁決）**：部署平台由 Render 改為 **GCP Cloud Run**（資料庫維持 **Neon Free**）。規格變更卡 **T-0010**（plan-sd）正在改寫 `ADR-0003` → `ADR-0005`、`06_部署架構與CICD.md`、SD 的容器圖。
> 本書受影響處只有兩個工作項：**WI-01（骨架卡）** 與 **WI-08（部署卡）**，兩者的任務卡 `depends_on` 須含 `T-0010`；**其餘六個工作項不受影響**。部署細節一律以 T-0010 完成後的 `06_*.md` 為準，本書只寫到「依 `06_*.md` 第 3 章 pipeline」的層級。

DoD：每個工作項對應一張任務卡，有角色、SD 模組、API/UC、依賴、估計回合、outputs（精確路徑）與可執行的驗收指令；**同批次 outputs 互不交集**；批次 1 只含無依賴項目。

**本書的定位**：回答「誰、在哪張卡、寫哪些檔案、怎麼證明寫對了」。技術「為什麼這樣選」看 ADR，模組「負責什麼」看 SD 第 3 章 —— 本書**不重寫設計**，只把設計切成可派工的單位。Leader 可直接照第 6 章的對照表建卡。

---

## 0. 硬前提（不可自行更動，違反即退回）

| # | 前提 | 來源 |
|---|---|---|
| 1 | 規格包已凍結。**發現設計有誤不得自行改規格**，提「規格變更請求」任務卡，並寫進該卡交接檔「需要 Leader 裁決的事」 | Gate 1、CLAUDE.md 寫入權責表 |
| 2 | 每張開發卡一條分支 `task/T-####-slug`，自 `main` 切出；**合併只由 dev-tl 執行** | SD §8.2、CLAUDE.md |
| 3 | 開發者為 Sonnet 等級，工作項須小到**單卡一輪可完成（估計回合 1）** | Epic 限制 |
| 4 | 規模上限：P0 後端 3–5 卡、前端 1–2 卡、DevOps 1–2 卡。**本書為後端 4、前端 2、DevOps 2** | Epic 限制 |
| 5 | 憑證與雲端帳號由使用者提供。**倉庫中不得出現任何憑證值**（違反即阻擋級安全缺陷） | Epic 限制、BR-016、`06_*.md` §4 |
| 6 | 開發機為 Windows 11；全部指令須可在 **Git Bash 或 PowerShell** 執行（不得使用 `make`、`*.sh`、`/bin/bash` 專屬語法） | Epic 限制、NFR-008 |
| 7 | 外掛一律使用**官方套件並釘選版本**：`@fastify/basic-auth`、`@fastify/static`、（P1）`@fastify/jwt`；Node `22-alpine`、TypeScript `~5.6`、Fastify `^5`。**不得自行發明中介層** | ADR-0001「後果」 |
| 8 | `src/app.ts` 的**外掛註冊順序不可調換**（error-handler → basic-auth → health → static → todos routes）。順序錯了靜態檔會不設防 | SD §8.1 末 |

---

## 1. P0 工作項

估計回合一律為 **1**。`outputs` 為**精確路徑**；同批次不交集的驗證見第 7 章。

### 總表

| WI | 標題 | 角色 | SD 模組 | API／UC | 依賴 | 估計回合 | 建議卡 | outputs（精確路徑） |
|---|---|---|---|---|---|---|---|---|
| WI-01 | 專案骨架 ＋ CI ＋ 本機可跑 `/health` ＋ README 初版 | dev-ops | BE-01, BE-07, OPS-01, OPS-02 | `GET /health`／UC-010, UC-011 | — | 1 | T-0011 | `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `.gitignore`, `.env.example`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`, `src/server.ts`, `src/app.ts`, `src/config.ts`, `src/routes/health.ts`, `tests/integration/health.test.ts`, `README.md` |
| WI-02 | 統一錯誤處理器與錯誤契約 | dev-be | BE-03 | 全端點錯誤回應／UC-009(E4) | WI-01 | 1 | T-0012 | `src/plugins/error-handler.ts`, `src/schemas/error-schema.ts`, `tests/unit/error-handler.test.ts`, `tests/integration/error-contract.test.ts`, `src/app.ts`（僅 `[ANCHOR:error-handler]` 一處） |
| WI-03 | 資料層：連線池、migration runner、todo repository | dev-be | BE-08, BE-06 | —（不對外）／UC-001~UC-007, UC-010 | WI-01 | 1 | T-0013 | `migrations/001_create_todos.sql`, `src/db/pool.ts`, `src/db/migrate.ts`, `src/repositories/todo-repository.ts`, `tests/integration/todo-repository.test.ts` |
| WI-04 | 前端版面與 API 用戶端 | dev-fe | FE-01, FE-02 | `GET /`、`/assets/*`／UC-008, UC-009 | WI-01 | 1 | T-0014 | `public/index.html`, `public/styles.css`, `public/assets/api-client.js`, `tests/unit/api-client.test.mjs` |
| WI-05 | 全站 Basic Auth、`/health` 唯一豁免、靜態託管 | dev-be | BE-02, BE-09 | 全路徑／UC-008~UC-011 | WI-01, WI-02, WI-04 | 1 | T-0015 | `src/plugins/basic-auth.ts`, `src/plugins/static.ts`, `tests/integration/auth-basic.test.ts`, `src/app.ts`（僅 `[ANCHOR:auth]`、`[ANCHOR:static]` 兩處） |
| WI-06 | 待辦 API 與業務規則 | dev-be | BE-04, BE-05 | `/api/v1/todos` 五端點／UC-001~UC-007, UC-009 | WI-02, WI-03, WI-05 | 1 | T-0016 | `src/routes/todos.ts`, `src/services/todo-service.ts`, `src/schemas/todo-schema.ts`, `tests/unit/todo-service.test.ts`, `tests/integration/todos-api.test.ts`, `src/app.ts`（僅 `[ANCHOR:routes]` 一處） |
| WI-07 | 前端狀態與呈現（單向資料流） | dev-fe | FE-03, FE-04 | `/api/v1/todos` 五端點／UC-001~UC-008 | WI-04, WI-06 | 1 | T-0017 | `public/assets/todo-store.js`, `public/assets/todo-view.js`, `tests/unit/todo-store.test.mjs` |
| WI-08 | staging 部署（Cloud Run）、健康監測、回滾演練 | dev-ops | OPS-03, OPS-04 | `GET /health`／UC-010, UC-011 | WI-01, WI-05, WI-06 | 1（＋遠端待驗，不計回合） | T-0018 | `infra/cloudrun-service.yaml`, `.github/workflows/deploy-staging.yml`, `.github/workflows/monitor-health.yml`, `docs/specs/06_部署架構與CICD.md`（**僅限三處實作紀錄**，見 §1.8）, `README.md`（部署與 secrets 章節） |

> **「依賴」欄只表達工作項之間的依賴**（決定批次），因此批次 1 的 WI-01 仍為「—」。
> **另有一項「建卡前置」不在此欄**：使用者已裁決部署平台由 Render 改為 **GCP Cloud Run**（資料庫維持 Neon Free），規格變更卡 **T-0010**（plan-sd）正在改寫 `ADR-0003` → `ADR-0005`、`06_部署架構與CICD.md`、SD 容器圖。
> 因此 **WI-01（T-0011）與 WI-08（T-0018）的任務卡 `depends_on` 須含 `T-0010`**；其餘六個工作項**不受影響**（它們不觸碰部署平台）。部署相關細節一律以 T-0010 完成後的 `06_*.md` 為準，本書只寫到「依 `06_*.md` 第 3 章 pipeline」的層級。

### 1.1 WI-01 專案骨架 ＋ CI ＋ 本機可跑 `/health` ＋ README 初版（dev-ops）

**為什麼是第一張卡**：在它綠燈之前，沒有任何其他卡可以執行 `npm`、`docker build` 或 `node --test`。它同時鎖定 Node／TypeScript／Fastify 的版本，之後的卡不再有選型自由度。

**部署目標：GCP Cloud Run**（使用者裁決 2026-09-19；資料庫維持 Neon Free）。本卡的 `Dockerfile` 與 `ci.yml` 須以此為前提：

- 映像存放於 **Artifact Registry**；`ci.yml` 的 build 階段只做 `docker build`（不推送），推送與部署由 WI-08 的 `deploy-staging.yml` 負責。
- GitHub Actions 取得 GCP 權限一律使用 **Workload Identity Federation**，**不得使用長期服務帳號金鑰**（金鑰檔一旦進倉庫即為阻擋級安全缺陷）。
- Cloud Run 監聽 **`$PORT`**（平台注入），容器**不得寫死埠號**；`Dockerfile` 的 runtime 為 `node:22-alpine` 非 root，**不得使用 Render 專屬設定**。
- **本卡的 `depends_on` 須含規格變更卡 `T-0010`**（plan-sd 正改寫 `ADR-0005` 與 `06_部署架構與CICD.md`）。平台相關細節一律以 T-0010 完成後的 `06_*.md` 為準；本卡只需做到「本機 `docker build` ＋ `docker compose up` 可跑 `/health`」，不預先實作任何雲端資源。

背景與限制（必須寫進任務卡）：

- 一次裝齊 **P0 全部執行期相依**並釘選版本：`fastify@^5`、`@fastify/static`、`@fastify/basic-auth`、`pg`；開發相依：`typescript@~5.6`、`eslint`、`@types/*`。**後續卡不得再改 `package.json`／`package-lock.json`**（單一擁有者，見 §5）。
- `src/config.ts` 一次宣告並驗證 **P0 全部環境變數**（`NODE_ENV`、`PORT`、`DATABASE_URL`、`BASIC_AUTH_USER`、`BASIC_AUTH_PASSWORD`、`LOG_LEVEL`、`CORS_ALLOWED_ORIGINS`；`06_*.md` §4.1），缺必要項即啟動失敗並印出缺哪一個。**後續卡不得再改 `config.ts`**。
- `src/app.ts` 建立時即寫入第 8 條硬前提的**五個註冊位置錨點**（見 §5），本卡只實作 health 路由的註冊。
- `docker-compose.yml` 的 Postgres 帳密、`BASIC_AUTH_*` 一律以 `${VAR}` 從 `.env` 讀取；`.env` 必須在 `.gitignore` 內。**倉庫任何檔案不得出現憑證值**。
- `package.json` 的 `scripts` 一次定齊：`dev`、`build`、`start`、`lint`、`test:unit`、`test:integration`、`migrate`、`verify:health`（即使對應目標尚未存在），避免後續卡爭搶同一檔案。
- 本卡決定並寫入 README：`package.json` 的 `type` 與 `tsconfig` 的 `module` 設定。**前端測試檔副檔名須與該決定一致**（本書假設為 ESM，故前端測試命名為 `*.test.mjs`；若本卡決定不同，Leader 於建卡時同步修正 WI-04／WI-07 的 outputs）。
- README 初版須**同時提供 Git Bash 與 PowerShell 兩種寫法**（NFR-008）。

驗收方式草案（可執行指令）：

```bash
npm ci && npm run lint                       # exit 0（ESLint + tsc --noEmit）
npm run build && ls dist/server.js           # 產出存在
npx --yes @redocly/cli lint docs/specs/04_API規格.yaml   # exit 0（CI lint 階段同一指令）
docker build -t todo-app:dev .               # 成功
docker compose up -d
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8080/health   # 200
curl -sS http://localhost:8080/health                                     # {"status":"ok"}
node --test "tests/integration/**/*.test.ts"  # 綠（glob 寫法；見下方註）
grep -rnE "(PASSWORD|SECRET|DATABASE_URL)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9]" . --include=Dockerfile --include=docker-compose.yml --include=*.json --include=*.ts --include=*.yml   # 無輸出
grep -n "^\.env$" .gitignore                 # 有輸出
grep -cE "ANCHOR:(error-handler|auth|static|routes|p1-auth-routes)" src/app.ts   # 5
```

> **`node --test` 一律用 glob，不用目錄路徑**（Leader 裁決 ③，2026-09-19；dev-tl 於 T-0011 審核時實測並修正本書）：`node --test tests/integration/`（目錄寫法）在 Windows ＋ Node v24.15.0 會把目錄路徑當成 CommonJS 模組解析而失敗（`Error: Cannot find module ...`，exit 1），以全新最小範例即可重現，與本專案程式碼無關。改用 `node --test "tests/integration/**/*.test.ts"` 效果等價（遞迴尋找、綠燈判定相同）。本書 §1.2、§1.3、§1.5~§1.7 的 `node --test <單一檔案路徑>` 不受影響（指到檔案而非目錄）。

### 1.2 WI-02 統一錯誤處理器與錯誤契約（dev-be）

**為什麼獨立成卡**：它是 `src/app.ts` 上**第一個**註冊者，也是之後每一張卡的回應契約前提。錯誤結構若各處自行拼裝，NFR-005 與 AC-009-4 會在 Gate 2 才炸開。

背景與限制：

- 錯誤物件**唯一**形狀：`{ code, message, details?, requestId }`（SD §6.1）。`requestId` 必須與 pino 的 `reqId` **同值**。
- 5xx 的 `message` 為**固定字面值** `Internal Server Error`，**不得含 `details`**、不得含堆疊／SQL／內部路徑（BR-026、NFR-002②）。
- `details` 只出現在 4xx，且**只含欄位名稱與規則，不回射使用者輸入原文**。
- 同時設定 `setNotFoundHandler`，使未知路徑也回同一結構。
- pino 設 `redact: ["req.headers.authorization"]`（`06_*.md` §4「禁止事項」）。
- 錯誤碼表以 SD §6.1 為準：`E_VALIDATION`/400、`E_UNAUTHORIZED`/401、`E_NOT_FOUND`/404、`E_INTERNAL`/500（`E_EMAIL_TAKEN`/409 為 P1，本卡可預留常數但不使用）。

驗收方式草案：

```bash
node --test tests/unit/error-handler.test.ts          # 綠
node --test tests/integration/error-contract.test.ts  # 綠
curl -sS http://localhost:8080/no-such-path | grep -o "\"requestId\""        # 有輸出（404 走統一結構）
curl -sS http://localhost:8080/no-such-path | grep -cE "stack|at .*\.ts:"    # 0
grep -n "redact" src/plugins/error-handler.ts                                # 有輸出
grep -n "Internal Server Error" src/plugins/error-handler.ts                 # 有輸出（固定字面值）
```

### 1.3 WI-03 資料層：連線池、migration runner、todo repository（dev-be）

背景與限制：

- `migrations/001_create_todos.sql` **逐字採用** `05_資料庫設計.md` §3 的 DDL（含 `CHECK (char_length(btrim(title)) BETWEEN 1 AND 200)` 與 `trg_todos_protect_created_at` 觸發器）。
- migration runner 行為規格見 `05_*.md` §3「migration runner」五條：`schema_migrations` 記錄版本、依檔名排序、**單一交易內**執行、失敗 rollback 並以非 0 結束、**只前進不回退**、應用啟動時自動執行。
- `pg.Pool` 設 `max: 5`（SD §7 NFR-001 對策②）。
- 清單查詢一律 `ORDER BY created_at DESC, id DESC`；狀態篩選在 **SQL WHERE** 做（O-003）。
- **`snake_case` ↔ `camelCase` 轉換的唯一位置在本層**（BE-06），上層不得再轉。
- **阻擋級 CR 判準**：repository 的 SQL 字串內不得出現 `${`（`05_*.md` §3 末）。

驗收方式草案：

```bash
docker compose up -d db
npm run migrate                                        # 首次套用
npm run migrate                                        # 再跑一次為 no-op（冪等）
node --test tests/integration/todo-repository.test.ts  # 綠
grep -nE "\\$\\{" src/repositories/todo-repository.ts  # 無輸出（阻擋級判準）
# 以 psql 驗 CHECK：全空白標題必須被擋
docker compose exec -T db psql -U postgres -d todo -c "INSERT INTO todos (title) VALUES ('   ');"   # 失敗，違反 todos_title_not_blank
docker compose exec -T db psql -U postgres -d todo -c "SELECT version FROM schema_migrations;"      # 含 001
```

測試須覆蓋：500 筆同秒建立後排序為**決定性**（NFR-007，tie-break 已定，斷言可寫死）。

### 1.4 WI-04 前端版面與 API 用戶端（dev-fe）

背景與限制：

- 全部互動**在同一頁**（AC-008-1）：新增輸入框、篩選控制項、清單容器、載入中指示、錯誤訊息區。
- 版面以 flexbox ＋ **單一 `@media` 斷點 768px**，控制項最小點擊區 **44×44 px**，**不使用橫向捲動**（BR-031、NFR-004）。
- `api-client.js` 組 **`/api/v1/*` 相對路徑**，**不寫死網域**（同源，O-004、ADR-0004）；解析統一錯誤物件並轉為具名例外；**不碰 DOM**。
- **全專案禁止 `innerHTML`**（BR-013、NFR-002⑤）。
- 本卡以 mock 開發，不依賴後端 API 實作完成。

驗收方式草案：

```bash
npm run lint                                         # exit 0
node --test tests/unit/api-client.test.mjs           # 綠（注入 fetch stub）
grep -rn "innerHTML" public/                         # 無輸出
grep -rnE "https?://" public/assets/api-client.js    # 無輸出（不寫死網域）
grep -rnE "document\.|window\." public/assets/api-client.js   # 無輸出（不碰 DOM）
grep -n "@media" public/styles.css                   # 有 768px 斷點
```

另以瀏覽器於 **1280×800 與 390×844** 各開啟一次 `public/index.html`，確認無橫向捲動，截圖附卡。

### 1.5 WI-05 全站 Basic Auth、`/health` 唯一豁免、靜態託管（dev-be）

**為什麼 BE-02 與 BE-09 同一張卡**（dev-tl 技術仲裁，與 SD §3.4 建議不同，理由見 §4）：SD §6.2 的 CR 判準是「**未帶憑證取 `public/` 下的資產必須同樣回 401**」。這條判準需要 auth hook 與 static 兩者同時存在才驗得出來；拆成兩卡會出現「靜態檔已上線但尚未受保護」的視窗。

背景與限制（**本卡是整站唯一會「完全不設防」的單點，CR 從嚴**）：

- 豁免比對**必須對 pathname**（剝除 query 與 hash 後），**不是 `req.url`** —— Node 的 `req.url` 含查詢字串，`/health?cb=1` 會被擋成 401，造成 NFR-003 假失敗且極難查（plan-sa 於 `worklog/handoff/20260919-0628-T0004-r1-plan-sa.md` B 段交辦）。
- 比對**必須是完全相等的字串**，**禁止**前綴比對、萬用字元、正則（否則 `/healthz-secret`、`/health/../api/v1/todos` 會意外落入豁免）。
- **監測端呼叫 `/health` 時不得附加任何查詢字串**（同上交辦；`monitor-health.yml` 由 WI-08 落實，本卡於驗收中先證明兩種寫法皆通）。
- 未保護路徑**只有 `/health` 一條**。新增任何豁免視為規格變更，須走規格變更請求任務卡。
- hook 掛在**根實例**，涵蓋靜態檔與全部 API 路由；註冊順序 `basic-auth` **必須早於** `static` 與 routes（SD §8.1，順序錯了靜態檔不設防）。
- 帳密**只**來自 `BASIC_AUTH_USER`／`BASIC_AUTH_PASSWORD`；**倉庫中不得出現任何值**（BR-016，阻擋級）。
- 比對使用 `crypto.timingSafeEqual`（定時比較，避免時序側通道）。
- 401 須帶 `WWW-Authenticate: Basic realm="staging"`，且回應**不含任何待辦資料**。
- 使用官方外掛 `@fastify/basic-auth`、`@fastify/static`，**不得自行發明中介層**（ADR-0001）。

驗收方式草案（`$U`／`$P` 取自本機 `.env`，不入版控）：

```bash
curl -sS -o /dev/null -w "health-no-cred=%{http_code}\n"      http://localhost:8080/health          # 200
curl -sS -o /dev/null -w "health-with-query=%{http_code}\n"  "http://localhost:8080/health?cb=1"    # 200 ← pathname 比對
curl -sS -o /dev/null -w "healthz-secret=%{http_code}\n"      http://localhost:8080/healthz-secret  # 401 ← 禁前綴比對
curl -sS -o /dev/null -w "root-no-cred=%{http_code}\n"        http://localhost:8080/                # 401
curl -sS -o /dev/null -w "asset-no-cred=%{http_code}\n"       http://localhost:8080/assets/api-client.js   # 401 ← 靜態檔同樣受保護
curl -sS -o /dev/null -w "root-with-cred=%{http_code}\n" -u "$U:$P" http://localhost:8080/          # 200
curl -sSI http://localhost:8080/ | grep -i "^www-authenticate"   # Basic realm="staging"
grep -n "timingSafeEqual" src/plugins/basic-auth.ts              # 有輸出
grep -nE "startsWith|RegExp|\\*" src/plugins/basic-auth.ts       # 無輸出（禁前綴／萬用字元／正則）
node --test tests/integration/auth-basic.test.ts                 # 綠
```

### 1.6 WI-06 待辦 API 與業務規則（dev-be）

**本卡是 32 條 BR 中 12 條的落點，也是 CR 與單元測試的主戰場。**

背景與限制：

- **`title` 一律先 `trim()` 再驗長度，再交給 DB**（plan-sa 交辦）。原因：`title varchar(200)` 與 `CHECK(btrim(...))` 的錯誤路徑不同 —— 前後帶空白、總長 201~203 的標題若先進 DB，會以 PostgreSQL `22001` 走到 500，而非 BR-002 要求的 400 `E_VALIDATION`。**trim 必須早於任何 DB 長度檢查。**
- API schema：`title` `minLength:1, maxLength:200`；`status` `enum: [all, active, completed]`；`id` `format: uuid`；`removeAdditional: true`（BR-012「忽略」而非「拒絕」）。
- 業務層（BE-05）在 schema 之後**再驗一次** `trim()` 後長度 1~200（schema 的 `minLength` 擋不掉 `"   "`，**這是最常漏的一點**）；PATCH 至少要有一個可更新欄位否則 400。
- `PATCH` 是**設定目標狀態**（冪等），**不得實作 toggle 語意**（O-002）。
- `DELETE` 回 **204 無本文**（O-001）；不存在的 id 回 **404**（BR-009），且**不得因此建立新資料、不得回 5xx**。
- `id` 格式不合法回 **400**，格式合法但查無資料回 **404**（SD §5 第 6 點，分界寫死）。
- 回應欄位以 `04_API規格.yaml` 的 `Todo` schema 為準；**`updatedAt` 不得進回應**（O-008）。
- 業務規則的唯一落點是 `todo-service.ts`；`routes/todos.ts` 只做 schema 驗證與序列化。

驗收方式草案：

```bash
node --test tests/unit/todo-service.test.ts     # 綠，12 條 BR 逐條
node --test tests/integration/todos-api.test.ts # 綠
B="-u $U:$P -sS -o /dev/null -w %{http_code}\n"
curl $B -X POST http://localhost:8080/api/v1/todos -H "content-type: application/json" -d "{\"title\":\"buy milk\"}"   # 201
curl $B      http://localhost:8080/api/v1/todos                                   # 200
curl $B -X PATCH http://localhost:8080/api/v1/todos/$ID -H "content-type: application/json" -d "{\"isCompleted\":true}"  # 200
curl $B -X PATCH http://localhost:8080/api/v1/todos/$ID -H "content-type: application/json" -d "{\"isCompleted\":true}"  # 200（重送冪等，值仍為 true）
curl $B -X DELETE http://localhost:8080/api/v1/todos/$ID                          # 204
curl $B      http://localhost:8080/api/v1/todos/00000000-0000-4000-8000-000000000000   # 404
curl $B      http://localhost:8080/api/v1/todos/not-a-uuid                         # 400
curl $B -X POST http://localhost:8080/api/v1/todos -H "content-type: application/json" -d "{\"title\":\"   \"}"          # 400（trim 早於 DB）
curl $B -X PATCH http://localhost:8080/api/v1/todos/$ID -H "content-type: application/json" -d "{}"                      # 400
curl $B     "http://localhost:8080/api/v1/todos?status=bogus"                      # 400
curl -u $U:$P -sS http://localhost:8080/api/v1/todos | grep -c "updatedAt"         # 0（不進回應契約）
```

另須驗：201 字元（trim 後）標題回 **400 而非 500**；PATCH 夾帶 `id`／`createdAt` 被忽略且原值不變。

### 1.7 WI-07 前端狀態與呈現（dev-fe）

背景與限制：

- **嚴格單向資料流**：`使用者事件 → controller → api-client → todo-store（唯一可改狀態者）→ todo-view（只讀，整段重繪）`。**`todo-view` 不得呼叫 API，`api-client` 不得碰 DOM**（SD §3.2）。
- BR-011：任何異動後以**目前 filter 重新向後端取清單並整份替換**（不做局部 DOM 修補）。
- BR-010：filter 預設 `all`，**不寫網址、不持久化**。
- 一律以 `textContent` 寫入使用者輸入（BR-013）；`createdAt` 以 `Intl.DateTimeFormat` 轉**瀏覽器本地時區** `yyyy-mm-dd HH:mm`（BR-004）；不做相對時間。
- 空狀態提示（BR-028）、載入中指示（BR-030）、錯誤訊息（BR-029）、刪除前**二次確認**（BR-008）。
- 以 `DocumentFragment` 組完整清單後**單次插入**（NFR-007）。
- 本卡完成即應可在瀏覽器完成 US-001~US-007 全流程。

驗收方式草案：

```bash
node --test tests/unit/todo-store.test.mjs                     # 綠（BR-011 整份替換、BR-010 預設 all）
grep -rn "innerHTML" public/                                   # 無輸出
grep -n "fetch(" public/assets/todo-view.js                    # 無輸出（view 不得呼叫 API）
grep -nE "document\.|window\." public/assets/api-client.js     # 無輸出（client 不得碰 DOM）
grep -n "DocumentFragment" public/assets/todo-view.js          # 有輸出
grep -n "Intl.DateTimeFormat" public/assets/todo-view.js       # 有輸出
```

瀏覽器實測（截圖附卡）：① 標題為 `<script>alert(1)</script>` 的待辦 —— **無彈窗且文字原樣顯示**；② 建立時間顯示為本地時區 `yyyy-mm-dd HH:mm`；③ 刪除有二次確認；④ 切換篩選後網址不變、重整回 `all`；⑤ 清單為空時顯示空狀態提示。

### 1.8 WI-08 staging 部署、健康監測、回滾演練（dev-ops）

**設計成「離線可驗證到最後一步」**：工作流檔案要寫好且可被 lint；**每個 run step 的實際指令都要有等價的本地 npm script**，本地跑得過即代表雲端只差憑證。GitHub Actions 的實際執行**待使用者提供 GitHub repo** 後才可驗，不阻擋本卡進 review。

**部署目標為 GCP Cloud Run**（使用者裁決 2026-09-19，資料庫維持 Neon Free）：映像推送至 **Artifact Registry**，GitHub Actions 以 **Workload Identity Federation（WIF）** 取得部署權限（**不使用長期服務帳號金鑰**）。**細節一律以規格變更卡 T-0010 完成後的 `06_部署架構與CICD.md` 第 2、3 章為準**；本書只寫到「依 `06_*.md` 第 3 章 pipeline」的層級，不預先決定資源名稱與階段內容。

背景與限制：

- **`docs/specs/06_部署架構與CICD.md` 的設計部分已凍結**（T-0010 改寫後的版本同樣凍結）。本卡對該檔的寫入權**僅限**下列三處，且只能寫「實作紀錄」，**不得變更任何設計**：
  1. **環境清單章**：把 staging 的實際網址填入（Cloud Run 服務網址，由使用者建立服務時決定）。
  2. **回滾程序的演練要求節**：回填「演練紀錄：yyyy-mm-dd，結果：……」。
  3. **監控與告警章**：補監控實作紀錄（實際 artifact 路徑、取樣統計方式）。
  章節編號以 T-0010 完成後的 `06_*.md` 為準。以上以外的任何改動（含新增未保護路徑、改 pipeline 階段、改環境變數清單）一律走**規格變更請求任務卡**。
- `infra/cloudrun-service.yaml`（Cloud Run 服務宣告，IaC）**只含環境變數名稱、不含值**；機密一律以 Secret Manager 參照或部署時注入，**倉庫中不得出現任何值**。實際檔名與格式以 T-0010 完成後的 `06_*.md` 為準；若該書指定不同檔名，Leader 於建卡時同步修正本卡 outputs。
- `deploy-staging.yml` 階段順序固定：**migrate → deploy → verify**（依 `06_*.md` 第 3 章 pipeline；先 migrate 是 expand-contract 的 expand 階段）。deploy 階段以 WIF 驗證身分 → 推映像到 Artifact Registry → 部署新修訂版；verify 輪詢 `/health` 每 10 秒一次、上限 10 分鐘，再以 secrets 憑證打 `GET /api/v1/todos` 確認 200。
- `monitor-health.yml`：`cron: "*/5 * * * *"` ＋ `workflow_dispatch`；每次**連續取樣 3 次、間隔 20 秒**；**不得帶任何憑證**（帶憑證等於沒驗證 BR-017 的豁免是否生效）；**不得對 `/health` 附加任何查詢字串**（見 WI-05）；結果寫入 artifact。連續 3 次全失敗才以 `::error::` 標記。取樣頻率若 T-0010 後的 `06_*.md` 另有規定，以該書為準。
- **GitHub Actions 額度二選一**（`06_*.md` 雲端資源章）：本卡須擇一並**記錄在卡上**。若選私有＋降低取樣頻率，須同步調整 NFR-003 的取樣分母。
- **回滾演練**是 **Gate 2 前置條件**：staging 建立後執行一次平台層回滾（Cloud Run 修訂版切換）並回填日期與結果。
- 憑證與雲端帳號一律由使用者自行設定（GCP 專案、Artifact Registry、WIF 綁定、GitHub secrets）；**agent 不索取、不代填**。

驗收方式草案（本地可驗部分）：

```bash
npx --yes prettier@3 --check "infra/cloudrun-service.yaml" ".github/workflows/*.yml"   # YAML 可解析
grep -nE "(PASSWORD|SECRET|DATABASE_URL|_KEY|_TOKEN)[[:space:]]*:[[:space:]]*[^$\{[:space:]]" infra/cloudrun-service.yaml .github/workflows/*.yml   # 無輸出（無憑證值）
grep -n "/health" infra/cloudrun-service.yaml                                      # 健康檢查路徑為 /health
grep -nE "workload_identity_provider|auth@v" .github/workflows/deploy-staging.yml  # 有輸出（WIF，非長期金鑰）
grep -nE "credentials_json|service_account_key|\.json$" .github/workflows/deploy-staging.yml   # 無輸出（不得使用長期服務帳號金鑰）
grep -n "artifactregistry\|Artifact Registry" .github/workflows/deploy-staging.yml # 有輸出（映像推送目的地）
grep -n "cron" .github/workflows/monitor-health.yml                                # */5 * * * *
grep -nE "(-u |Authorization|BASIC_AUTH)" .github/workflows/monitor-health.yml     # 無輸出（監測不帶憑證）
grep -nE "/health\?" .github/workflows/monitor-health.yml                          # 無輸出（不得附查詢字串）
grep -n "migrate" .github/workflows/deploy-staging.yml | head -1                   # migrate 階段在 deploy 之前
npm run verify:health                                                              # 對 http://localhost:8080 回 200（與 workflow verify 階段同一指令）
```

遠端待驗（使用者提供 GitHub repo 後）：`ci.yml` 四階段全綠、`deploy-staging.yml` 三階段全綠、`monitor-health.yml` 產出 artifact。**本卡 review 時以本地驗收為準，遠端項目列入卡上「遠端待驗」清單交 Leader 追蹤。**

---

## 2. 平行批次

| 批次 | 工作項 | 可平行 | 說明 |
|---|---|---|---|
| **批次 1** | WI-01 | —（單卡） | **依賴欄全為「—」**。在它綠燈前無任何工具鏈可用 |
| **批次 2** | WI-02、WI-03、WI-04 | **三卡平行** | 三卡 outputs 交集為空；只有 WI-02 觸碰 `src/app.ts` |
| **批次 3** | WI-05 | —（單卡） | 全站安全單點，獨立 CR；只有本卡觸碰 `src/app.ts` |
| **批次 4** | WI-06 | —（單卡） | 只有本卡觸碰 `src/app.ts` |
| **批次 5** | WI-07、WI-08 | **兩卡平行** | outputs 交集為空（`public/assets/*` vs `infra/`＋`.github/workflows/`）；皆不觸碰 `src/app.ts` |

- **關鍵路徑**：WI-01 → WI-02 → WI-05 → WI-06 → WI-07／WI-08（5 個批次）。
- **WI-04 為何不放批次 1**：SD §3.4 標示前端① 無依賴（可用 mock 開發）。但它的驗收需要 `npm run lint` 與 `node --test`，而工具鏈由 WI-01 建立，因此依賴欄如實填 `WI-01`。**批次 1 仍嚴格只含無依賴項目。**
- **批次 3、4 為何不合併**：兩者都要在 `src/app.ts` 的不同錨點註冊（§5），同批次會產生 outputs 交集。WI-05 先於 WI-06 的另一個好處是：WI-06 的整合測試一開始就在「Basic Auth 已生效」的真實條件下跑。

---

## 3. 分支與合併策略

### 3.1 分支

- 每張開發卡一條分支 **`task/T-####-slug`**，自 `main` 切出（例：`task/T-0015-basic-auth`）。
- 文件卡（含本卡）直接 commit 到 `main`。
- **本 repo 目前無遠端**：`main` 的「受保護」以流程保證（只有 dev-tl 合併），不是以 GitHub 分支保護規則保證。使用者提供 GitHub repo 後，由 dev-ops 另開卡設定分支保護規則與 required status checks。
- commit 訊息 `T-####: 摘要`，結尾一行 `Co-Authored-By`，署**實際執行該卡的模型**。
- **禁止 commit**：`.env`、任何憑證、`node_modules/`、`dist/`。
- **Agent 的 git 只准 append**：禁止 `--amend`、`reset`、`rebase`、`checkout -- <file>`；只 `git add` 自己卡的 outputs，永不 `add -A`（CLAUDE.md 工作鐵則）。

### 3.2 合併

合併條件（三者皆須成立）：

1. **CI 綠燈** —— 目前無遠端，以**本地跑同一組指令**代替：`npm run lint` → `npm run test:unit` → `npm run build`（或 `docker build`）→ `npm run test:integration`，四者皆 exit 0。使用者提供 GitHub repo 後改以 `ci.yml` 的實際綠燈為準（指令完全相同，見 §3.3）。
2. **dev-tl 初審通過** —— 實際 checkout 該分支、實際跑 build 與測試、實際比對 `04_API規格.yaml`，把指令與輸出貼進審核交接檔。不過直接 `rework`，不進測試團隊。
3. **qa-cr 阻擋級 0**。

合併方式：由 dev-tl 在本地執行 **`git merge --no-ff task/T-####-slug`**（保留分支拓樸，日後 `git revert -m 1` 可整批回復），並更新 `CHANGELOG.md`。

### 3.3 CI 的「本地可跑同樣指令」對照

`.github/workflows/ci.yml` 的每個階段都必須是**本地可執行的同一條指令**，這是本 repo 無遠端期間的合併門檻，也是使用者接上 GitHub 後零意外的保證：

| CI 階段 | workflow 內的指令 | 本地等價指令 | 建立者 |
|---|---|---|---|
| lint | `npm ci && npm run lint` ＋ `npx @redocly/cli lint docs/specs/04_API規格.yaml` | 同左 | WI-01 |
| unit | `npm run test:unit`（即 `node --test "tests/unit/**/*.test.ts"`，glob 寫法見 §1.1 註） | 同左 | WI-01 |
| build | `docker build -t todo-app:$SHA .` | `docker build -t todo-app:dev .` | WI-01 |
| integration | service container 起 `postgres:16-alpine` → `npm run migrate` → `npm run test:integration` | `docker compose up -d db` → 同左 | WI-01（骨架）／WI-03（migrate） |

---

## 4. 與 SD §3.4 建議的差異（dev-tl 技術仲裁紀錄）

SD §3.4 的 8 張卡切法整體採用，卡數（後端 4／前端 2／DevOps 2）完全一致。三處調整與理由：

| # | SD §3.4 的建議 | 本書的安排 | 理由 |
|---|---|---|---|
| 1 | BE-01, BE-03, BE-07, BE-09 合為「後端① 服務骨架」 | **BE-01、BE-07 移入 WI-01（dev-ops）** | 任務卡 acceptance 3 要求第一個工作項是「專案骨架 ＋ CI ＋ 本機可跑 `/health` ＋ README 初版」且角色為 dev-ops。「本機可跑 `/health`」在定義上就包含 BE-01（app 組裝）與 BE-07（health 路由）；把它們留在後端①，第一張卡將無法自證 `/health` 可跑 |
| 2 | BE-09（static）在「後端① 服務骨架」 | **BE-09 移到 WI-05，與 BE-02 同卡** | SD §6.2 的 CR 判準是「未帶憑證取 `public/` 下的資產必須同樣回 401」。此判準需要 auth hook 與 static **同時存在**才驗得出；拆開會出現「靜態檔已上線但尚未受保護」的視窗，正是本專案唯一的整站不設防風險 |
| 3 | BE-03（error-handler）在「後端① 服務骨架」 | **BE-03 獨立為 WI-02** | ① 它是 `src/app.ts` 上第一個註冊者，也是之後每張卡的回應契約前提；② 讓 WI-01 維持在 dev-ops 可完成的範圍內（統一錯誤結構＋pino redact 是後端職責）；③ 獨立成卡後，錯誤契約可先於任何業務端點被釘死，避免各處自行拼裝 |

其餘（並行建議、關鍵路徑「後端①→②→③→前端②」）與本書的批次安排一致。

---

## 5. 共用檔案與寫入規約

多卡會依序寫到同一個檔案的只有三個。**規約：同一時間至多一張 `in_progress` 的卡持有該檔寫入權**；第 2 章的批次安排已保證這一點。

| 檔案 | 建立者 | 後續寫入者 | 規約 |
|---|---|---|---|
| `src/app.ts` | WI-01 | WI-02（`[ANCHOR:error-handler]`）→ WI-05（`[ANCHOR:auth]`、`[ANCHOR:static]`）→ WI-06（`[ANCHOR:routes]`）→（P1）WI-P1-01／02 | WI-01 建立時即寫入五個錨點註解，**順序固定不可調換**（硬前提 8）。每張卡**只在自己的錨點插入一行 `app.register(...)`**，不得改動其他行。**分屬不同批次，不構成同批次交集** |
| `package.json` / `package-lock.json` | WI-01 | **無** | WI-01 一次裝齊 P0 全部相依並定齊全部 scripts；後續卡若需新套件，須先向 dev-tl 提出，由 dev-tl 決定是否開修正卡 |
| `README.md` | WI-01（初版） | WI-08（部署與 secrets 章節） | 分屬批次 1 與批次 5，不構成同批次交集 |

`src/app.ts` 的錨點骨架（WI-01 建立，供 Leader 抄進卡上）：

```text
// [ANCHOR:error-handler]   ← WI-02 於此註冊 BE-03（必須最先）
// [ANCHOR:auth]            ← WI-05 於此註冊 BE-02 全域 hook（必須早於 static 與 routes）
app.register(healthRoutes)  //  WI-01 註冊 BE-07
// [ANCHOR:static]          ← WI-05 於此註冊 BE-09
// [ANCHOR:routes]          ← WI-06 於此註冊 BE-04
// [ANCHOR:p1-auth-routes]  ← P1：BE-10；並由 BE-13 取代 [ANCHOR:auth]
```

---

## 6. 給 Leader 的建卡對照表

卡號為建議值（`tasks/` 目前最大為 T-0009）。`reviewer` 一律 dev-tl（開發卡初審）。

| WI | 建議卡號 | 角色 | 分支 | depends_on | reviewer | acceptance 來源 |
|---|---|---|---|---|---|---|
| WI-01 | T-0011 | dev-ops | `task/T-0011-project-skeleton` | **[T-0010]**（規格變更卡：Render → Cloud Run） | dev-tl | §1.1 驗收方式草案 |
| WI-02 | T-0012 | dev-be | `task/T-0012-error-handler` | [T-0011] | dev-tl | §1.2 |
| WI-03 | T-0013 | dev-be | `task/T-0013-data-layer` | [T-0011] | dev-tl | §1.3 |
| WI-04 | T-0014 | dev-fe | `task/T-0014-ui-shell-api-client` | [T-0011] | dev-tl | §1.4 |
| WI-05 | T-0015 | dev-be | `task/T-0015-basic-auth` | [T-0011, T-0012, T-0014] | dev-tl | §1.5 |
| WI-06 | T-0016 | dev-be | `task/T-0016-todo-api` | [T-0012, T-0013, T-0015] | dev-tl | §1.6 |
| WI-07 | T-0017 | dev-fe | `task/T-0017-todo-store-view` | [T-0014, T-0016] | dev-tl | §1.7 |
| WI-08 | T-0018 | dev-ops | `task/T-0018-deploy-monitor` | **[T-0010]**, T-0011, T-0015, T-0016 | dev-tl | §1.8 |

每張卡的「背景與限制」欄**必須**抄入：① 該工作項 §1.x 的「背景與限制」全文；② 硬前提 5（倉庫不得出現憑證值）、6（Windows 可執行）、7（官方外掛與釘選版本）、8（註冊順序不可調換）；③ §5 的共用檔案規約（若該卡觸碰 `src/app.ts`）。

---

## 7. 驗證（本書自身的 DoD）

| # | 檢查 | 方法 |
|---|---|---|
| 1 | 每個工作項有角色、SD 模組、API/UC、依賴、估計回合、outputs | 第 1 章總表七欄無空白 |
| 2 | 批次 1 只含無依賴項目 | WI-01 依賴欄為「—」，且批次 1 只有 WI-01 |
| 3 | 同批次 outputs 無交集 | 逐批次列出全部 outputs 路徑排序後比對重複值（見交接檔 B 段實際輸出） |
| 4 | 第一個工作項為 dev-ops 的「專案骨架 ＋ CI ＋ 本機可跑 `/health` ＋ README 初版」 | WI-01 |
| 5 | 每個工作項有可執行的驗收指令 | §1.1~§1.8 各有一段 ```bash``` |
| 6 | P0／P1 分開，P1 標「Gate 2 後才開」 | 第 1、2 章為 P0；第 8 章為 P1 |
| 7 | SD 第 3 章的 17 個 P0 模組全部有歸屬 | 見下表 |

**P0 模組歸屬（17/17）**：

| 模組 | WI | 模組 | WI | 模組 | WI |
|---|---|---|---|---|---|
| BE-01 | WI-01 | BE-07 | WI-01 | FE-02 | WI-04 |
| BE-02 | WI-05 | BE-08 | WI-03 | FE-03 | WI-07 |
| BE-03 | WI-02 | BE-09 | WI-05 | FE-04 | WI-07 |
| BE-04 | WI-06 | OPS-01 | WI-01 | OPS-03 | WI-08 |
| BE-05 | WI-06 | OPS-02 | WI-01 | OPS-04 | WI-08 |
| BE-06 | WI-03 | FE-01 | WI-04 | | |

---

## 8. P1 工作項（**Gate 2 後才開**）

**下列工作項在 P0 Gate 2 通過前一律不建卡、不開分支。** 卡數與切法於 Gate 2 後由 Leader 重新裁定（Epic 的「後端 3–5／前端 1–2／DevOps 1–2」規模上限是對 P0 的約束）。

| WI | 標題 | 角色 | SD 模組 | API／UC | 依賴 | 估計回合 | outputs（精確路徑） |
|---|---|---|---|---|---|---|---|
| WI-P1-01 | 使用者表、註冊與登入端點 | dev-be | BE-10, BE-11, BE-12 | `POST /api/v1/auth/register`、`POST /api/v1/auth/login`／UC-012, UC-013 | P0 全部 done ＋ Gate 2 通過 | 1 | `migrations/002_create_users_and_owner.sql`, `src/routes/auth.ts`, `src/services/user-service.ts`, `src/repositories/user-repository.ts`, `tests/unit/user-service.test.ts`, `tests/integration/auth-api.test.ts`, `src/app.ts`（`[ANCHOR:p1-auth-routes]`） |
| WI-P1-02 | **JWT 取代 Basic Auth ＋ 待辦以 owner 隔離（單一卡、單一部署）** | dev-be | BE-13（取代 BE-02）, BE-05／BE-06 追加 BR-022／BR-023 | 全 `/api/v1/todos*`／UC-013, UC-014 | WI-P1-01 | 1 | `src/plugins/jwt-guard.ts`, `src/plugins/basic-auth.ts`（**刪除**）, `src/services/todo-service.ts`, `src/repositories/todo-repository.ts`, `src/app.ts`, `tests/integration/jwt-guard.test.ts` |
| WI-P1-03 | 前端註冊／登入頁與 token 保存 | dev-fe | FE-01~FE-04 擴充 | 同上／UC-012, UC-013 | WI-P1-02 | 1 | `public/login.html`, `public/assets/auth-client.js`, `public/assets/api-client.js`（加 `Authorization: Bearer`）, `public/assets/todo-view.js`（登出控制項）, `tests/unit/auth-client.test.mjs` |
| WI-P1-04 | P1 環境變數與部署切換 | dev-ops | OPS-03 擴充 | —／UC-010 | WI-P1-02 | 1 | `infra/cloudrun-service.yaml`（加 `JWT_SECRET`、`JWT_EXPIRES_IN`、`BCRYPT_COST` 名稱）, `.env.example`, `README.md`（P1 章節） |

**P1 的兩條硬性約束（開卡時必抄）**：

1. **SD-01（原子性）**：移除 Basic Auth 與導入 JWT **必須是同一次部署**，否則中間會出現完全不設防的視窗。因此 BE-13 與「移除 BE-02」**必須在同一張卡（WI-P1-02）、同一個 PR、同一次合併**。同理，owner 隔離（BR-022／BR-023）若晚於 JWT 導入，會出現「已登入但看得到別人待辦」的視窗，故一併併入 WI-P1-02。
2. **SD-02（資料清空）**：`TRUNCATE TABLE todos;` 必須在 `002_create_users_and_owner.sql` 內、`ALTER ... SET NOT NULL` **之前**（分開執行會讓 ALTER 失敗或留下違反 BR-023 的孤兒列）。**不得另寫一次性腳本。**

P1 追加的驗收重點：`password_hash` 為 bcrypt cost 12 且**明文絕不落庫**；登入失敗訊息**不區分**帳號不存在與密碼錯誤（BR-019）；跨使用者存取回 **404 而非 403**（O-001）；登出為用戶端清除 token，**無伺服器端端點**（O-006）。

---

## 9. 風險

| # | 風險 | 影響 | 對策 |
|---|---|---|---|
| R-01 | **`src/app.ts` 被多張卡依序寫入**，合併時衝突或註冊順序被寫錯 | 順序錯了靜態檔不設防（整站安全漏洞） | §5 的錨點規約 ＋ 批次安排保證同批次至多一張卡持有寫入權；WI-05 的驗收指令直接驗「未帶憑證取 `/assets/*` 回 401」，順序錯了驗收必紅 |
| R-02 | **本 repo 無遠端，CI 無法實際執行** | `ci.yml` 可能寫得過不了，到接上 GitHub 才爆 | §3.3 要求每個 CI 階段都有本地等價指令，合併門檻以本地四條指令為準；WI-08 的工作流以 prettier 驗 YAML 可解析；遠端項目列「遠端待驗」交 Leader 追蹤 |
| R-03 | **staging 尚不存在**，回滾演練（`06_*.md` §5.4）與 NFR-003 的 24 小時採樣無法在開發階段完成 | Gate 2 前置條件落空 | WI-08 標為「Gate 2 前置，staging 建立後補」；Leader 於 Gate 2 檢查清單納入此兩項 |
| R-04 | **雲端平台冷啟**（Cloud Run 縮到零實例時的首次請求）造成 NFR-001／NFR-003 假失敗 | 誤判為應用缺陷 | 判讀規則以 T-0010 完成後的 `06_*.md` 監控章為準：未達標須先區分應用缺陷與平台冷啟；NFR-001 量測先暖身 10 秒。若該書允許設定最小實例數，由 WI-08 於 `infra/cloudrun-service.yaml` 落實 |
| R-05 | **GitHub Actions 額度**（私有倉庫每 5 分鐘監測會超額） | 監測中斷 → 服務休眠 → NFR-003 連鎖失敗 | WI-08 須於卡上二選一並記錄（`06_*.md` §2，建議公開倉庫） |
| R-06 | 開發者為 Sonnet 等級，**Fastify 訓練資料較少**，可能自行發明中介層 | 偏離 ADR-0001，CR 退回 | 硬前提 7 ＋ 每張卡背景欄必抄官方外掛名稱；WI-05 的 `grep -nE "startsWith\|RegExp"` 驗收直接擋掉自創比對邏輯 |
| R-07 | `title` 的 trim 順序寫錯 → 201~203 字元標題走 500 而非 400 | AC 不通過且難查 | WI-06 背景欄明寫「trim 早於任何 DB 長度檢查」＋ 專屬驗收指令 |
| R-08 | `/health` 豁免以 `req.url` 比對 → 帶查詢字串時 401 | NFR-003 假失敗且極難查 | WI-05 背景欄明寫比對 pathname ＋ `curl "/health?cb=1"` 須 200 的驗收指令；WI-08 另驗監測端不得附查詢字串 |
| R-09 | **部署平台變更（Render → Cloud Run）與 WI-01 開卡時間賽跑** —— 若 T-0010 尚未 done 就派 WI-01，`Dockerfile`／`ci.yml` 可能寫成 Render 形狀而重做 | WI-01 退回重做，關鍵路徑整體延後一輪 | WI-01 與 WI-08 的 `depends_on` 含 `T-0010`（§6 對照表已標）；WI-01 的範圍刻意只到「本機 `docker build` ＋ `docker compose up` 可跑 `/health`」，不預先實作任何雲端資源，使平台細節的變動不會波及本卡已完成的部分 |
| R-10 | **GCP 長期服務帳號金鑰被寫進倉庫**（WIF 設定較繁瑣，開發者可能改用金鑰檔抄近路） | 阻擋級安全缺陷，等同外洩雲端專案控制權 | WI-01 背景欄明寫「不得使用長期服務帳號金鑰」；WI-08 驗收含 `grep -nE "credentials_json\|service_account_key\|\.json$" .github/workflows/deploy-staging.yml` 須無輸出 |

---

## 10. 未決事項（交 Leader）

| # | 事項 | 現況 | 建議 |
|---|---|---|---|
| D-01 | **`.env.example` 是否可含本機專用的預設值** —— `06_*.md` §4 要求「`.env.example` 只含名稱」且「任何憑證值不得出現在程式碼」；但 SD §7 NFR-008 要求「`.env.example` 列齊全部變數名稱與說明，**複製即可用**」。兩者在 `docker compose up` 的情境下互斥：空值的 `BASIC_AUTH_PASSWORD` 會讓應用啟動失敗 | 本書的**暫定假設**：`.env.example` 可含**僅限本機 compose 的明顯佔位值**（如 `dev`），staging／prod 的值一律只存在於平台 secrets；WI-01 的驗收掃描排除 `.env.example` | 請 Leader 裁決。若裁決為「一律不得有值」，WI-01 改為在 README 明列「複製後必須自行填 3 個變數」，並接受 NFR-008 的「複製即可用」改讀為「複製並填 3 個變數即可用」 |
| D-02 | **`eslint.config.js` 未出現在 SD §8.1 目錄樹**，但 `06_*.md` §3.1 的 lint 階段要跑 ESLint | 本書已將其列入 WI-01 的 outputs | 視為目錄樹未窮舉，非設計錯誤。若 Leader 認為需更新 SD §8.1，走規格變更請求任務卡 |
| D-03 | **`package.json` 的 `type` 與 `tsconfig` 的 `module`** 規格未指定，但會決定前端測試檔副檔名 | 本書假設 ESM，故前端測試命名為 `*.test.mjs` | 由 WI-01 決定並寫入 README；若決定不同，Leader 於建卡時同步修正 WI-04／WI-07 的 outputs 路徑 |

---

## 11. 變更紀錄

| 版本 | 日期 | 變更 | 依據 |
|---|---|---|---|
| 0.3 | 2026-09-19 | §1.1 驗收指令與 §3.3 unit 階段的 `node --test <目錄>` 改為 glob 寫法 `node --test "tests/**/*.test.ts"`，並於 §1.1 加註平台限制說明 | Leader 裁決 ③（2026-09-19T08:13:18+08:00）；dev-tl 於 T-0011 審核時實測重現目錄寫法失敗 |
