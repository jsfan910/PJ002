# CHANGELOG

格式：每個合併的任務卡一行 `T-#### 摘要`，最新在上。由 dev-tl 於合併時寫。

## [Unreleased]

- T-0015 全站 Basic Auth、`/health` 唯一豁免、靜態託管（`src/plugins/basic-auth.ts` 全域 `onRequest` hook 掛根實例、涵蓋靜態檔與全部後續路由；豁免比對 pathname 且為完全相等字串，`/health?cb=1` 放行而 `//health`／`/health/`／`/healthz-secret` 一律 401；`crypto.timingSafeEqual` 常數時間比較、帳密只來自環境變數；401 附 `WWW-Authenticate: Basic realm="staging"` 並經全域 error-handler 序列化為 `Error` schema；`src/plugins/static.ts` 以 `@fastify/static` 供應 `public/`、`prefix: "/"`、無目錄列表、`Cache-Control: no-store, private`）
- T-0014 前端版面與 API 用戶端（`public/index.html`／`styles.css` 單頁骨架，flexbox ＋ 單一 768px 斷點、44×44 點擊區、11 個穩定 `data-testid`；`public/assets/api-client.js` 對應五個 `/api/v1/todos*` 端點，相對路徑不寫死網域、不碰 DOM、統一錯誤物件轉具名例外 `ApiError`／`NetworkError`；無框架無打包器；Dockerfile 兩階段各補一行 `COPY public ./public`）
- T-0013 資料層：連線池、migration runner、todo repository（`migrations/001_create_todos.sql` 逐字採用 05 §3 DDL；`src/db/pool.ts` `max: 5`；`src/db/migrate.ts` 單一交易、`schema_migrations` 記錄版本、forward-only；`src/repositories/todo-repository.ts` 全參數化查詢、`snake_case↔camelCase` 唯一轉換點、清單含 `id` tie-break）
- T-0012 統一錯誤處理器與錯誤契約（`src/plugins/error-handler.ts` 全域 `setErrorHandler`／`setNotFoundHandler`；`src/schemas/error-schema.ts` 的 `AppError`／`buildErrorBody` 對齊 04 的 `Error` schema；5xx 固定字面值 `Internal Server Error` 且不含 `details`；`requestId` 與 pino `reqId` 同值）
- T-0011 專案骨架 ＋ CI ＋ 本機可跑 `/health` ＋ README 初版（Fastify 5／TypeScript ~5.6／ESM；`src/app.ts` 五個註冊錨點；`src/config.ts` 一次驗證 P0 全部環境變數；Cloud Run 形狀的 Dockerfile 與本機 docker-compose；`ci.yml` lint／unit／build／integration 四階段不推送）
