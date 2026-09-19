/**
 * tests/integration/health.test.ts
 *
 * GET /health（BE-07）驗收：200、固定回應 {"status":"ok"}、不依賴資料庫。
 * 測試以 app.inject() 直接呼叫路由，不需啟動真實 TCP 監聽，也不需要
 * 本機 Postgres —— 這正是「health 端點不應依賴 DB」的驗證方式
 * （NFR-003 設計對策②）。環境變數在本檔以 ??= 給預設值，使測試不依賴
 * 外部 .env，CI 與本機皆可直接執行 `node --test tests/integration/`。
 *
 * 匯入路徑指向 dist/（已編譯輸出），而非 src/：Node 的原生 TypeScript
 * 型別剝除不會把 import 規格中的 `.js` 副檔名回頭解析成同名 `.ts` 檔
 * （這是 TypeScript 5.7 的 `rewriteRelativeImportExtensions` 才有的能力，
 * 本專案釘選 TypeScript ~5.6，尚無此功能）。因此本測試依賴驗收流程中
 * 「先 `npm run build` 再跑測試」的順序（見 WBS §1.1 驗收方式草案第 2、8
 * 行；CI 的 integration job 同樣先跑 build 才跑本測試）。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../../dist/app.js";
import { loadConfig } from "../../dist/config.js";

process.env.NODE_ENV ??= "test";
process.env.PORT ??= "8080";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.BASIC_AUTH_USER ??= "test";
process.env.BASIC_AUTH_PASSWORD ??= "test";
process.env.LOG_LEVEL ??= "silent";

test("GET /health 回 200 與固定的 {status:ok}", async () => {
  const app = buildApp(loadConfig());

  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });

  await app.close();
});

test("GET /health 帶查詢字串仍回 200（pathname 比對，非 req.url 比對）", async () => {
  const app = buildApp(loadConfig());

  const response = await app.inject({ method: "GET", url: "/health?cb=1" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });

  await app.close();
});
