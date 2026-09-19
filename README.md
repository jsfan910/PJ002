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

**Git Bash**

```bash
cp .env.example .env
npm ci
npm run build
npm start                       # 另開一個終端機視窗執行下一步
curl -sS http://localhost:8080/health
```

**PowerShell**

```powershell
Copy-Item .env.example .env
npm ci
npm run build
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
| 單元測試 | `npm run test:unit` |
| 整合測試（需先 `npm run build`，見下方限制） | `npm run test:integration` |
| Migration（尚未實作，由 T-0013 補上） | `npm run migrate` |
| 驗證 `/health`（尚未實作，由 T-0018 補上） | `npm run verify:health` |
| 本機 Docker 建置 | `docker build -t todo-app:dev .` |
| 本機一行帶起 app＋db | `docker compose up -d` |

### 已知平台限制（本卡驗收時記錄，供後續卡與 CI 參考）

- `node --test <目錄>`（不帶副檔名 glob，例如 `node --test tests/integration/`）在本機 Node v24.15.0／Windows 上會誤把目錄路徑當成 CommonJS 模組解析而失敗（`Error: Cannot find module ...`），與本專案程式碼無關（以一個全新的最小範例目錄即可重現同一錯誤）。因此 `test:unit`／`test:integration` 兩個 script 改用明確的 glob（`"tests/unit/**/*.test.ts"`／`"tests/integration/**/*.test.ts"`），效果等價、可正常遞迴尋找測試檔。
- `tests/integration/health.test.ts` 匯入路徑指向 `../../dist/`（編譯後產物）而非 `../../src/`：Node 原生的 TypeScript 型別剝除不會把 `.js` 匯入規格自動對應回同名 `.ts` 檔（這是 TypeScript 5.7 的 `rewriteRelativeImportExtensions` 才有的能力；本專案釘選 `~5.6`，尚無此功能）。因此**跑整合測試前務必先 `npm run build`**（`npm run test:integration` 之前的所有本文件範例皆已按此順序排列）。

## 目錄結構

（對應 `docs/specs/03_系統設計書_SD.md` 第 8 章；本卡建立的部分如下，其餘由後續卡補上）

```
.
├── .github/workflows/ci.yml     # lint → unit → build → integration（本卡）
├── src/
│   ├── server.ts                 # 啟動、監聽 $PORT、優雅關機
│   ├── app.ts                     # Fastify 組裝＋五個註冊錨點（順序固定，見檔內註解）
│   ├── config.ts                  # 一次驗證 P0 全部環境變數
│   └── routes/health.ts           # GET /health（唯一未保護路徑）
├── tests/integration/health.test.ts
├── Dockerfile                     # 多階段，node:22-alpine 非 root，監聽 $PORT
├── docker-compose.yml             # 本機 app + postgres:16-alpine
├── .env.example                   # 只有本機 compose 用的明顯佔位值，無真實憑證
└── README.md
```

## 環境變數

見 `.env.example`（本機佔位值）與 `docs/specs/06_部署架構與CICD.md` 第 4 章（名稱、用途，**不含任何值**）。`DATABASE_URL`／`BASIC_AUTH_USER`／`BASIC_AUTH_PASSWORD` 在 staging 只存在於 GCP Secret Manager 與 GitHub secrets，agent 不索取、不代填。

## 部署與雲端資源

staging 部署於 GCP Cloud Run（WIF 認證、Artifact Registry 存放映像），詳細的資源建立指令、GitHub secrets／variables 設定與回滾程序，見 `docs/specs/06_部署架構與CICD.md` 與本文件後續由部署卡（T-0018）補上的章節。

## 文件地圖

- 規格：`docs/specs/`
- 任務：`tasks/`
- 部署：`docs/specs/06_部署架構與CICD.md`
- ADR：`docs/specs/adr/`
