/**
 * tests/integration/error-contract.test.ts
 *
 * 統一錯誤處理器（BE-03）的整合測試：以真正組裝出的 Fastify app（含
 * src/app.ts 的 [ANCHOR:error-handler] 註冊）驗證錯誤契約，並沿用
 * tests/integration/health.test.ts 的寫法——匯入 `../../dist/...`（已編譯
 * 產物）、以 `process.env.X ??=` 給測試預設值、用 `app.inject()` 不開
 * 真實 TCP（見 README「已知平台限制」；跑本測試前必須先 `npm run build`）。
 *
 * 除了驗證未知路徑（setNotFoundHandler）之外，另外在同一個 app 實例上
 * 掛一條「僅測試用」的路由來觸發 AppError／schema 驗證錯誤／未預期例外，
 * 藉此驗證全域 error handler 對「WI-02 之後才註冊的路由」是否同樣生效
 * ——這正是本卡設計筆記所擔心的 Fastify 封裝問題的關鍵驗收點。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../../dist/app.js";
import { loadConfig } from "../../dist/config.js";
import { AppError } from "../../dist/schemas/error-schema.js";

process.env.NODE_ENV ??= "test";
process.env.PORT ??= "8080";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.BASIC_AUTH_USER ??= "test";
process.env.BASIC_AUTH_PASSWORD ??= "test";
process.env.LOG_LEVEL ??= "silent";

function buildTestApp() {
  const app = buildApp(loadConfig());

  // 僅測試用路由：驗證「WI-02 之後才註冊」的路由是否同樣受全域 error
  // handler 保護（沒有另外 app.register 包一層，直接掛在根實例上，模擬
  // WI-06 未來會做的事）。
  app.get("/__test/app-error", async () => {
    throw new AppError("E_VALIDATION", "title must not be empty after trimming", {
      field: "title",
      rule: "minLength"
    });
  });
  app.get("/__test/not-found-error", async () => {
    throw new AppError("E_NOT_FOUND", "Todo not found");
  });
  app.get("/__test/boom", async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:5432 — internal pg detail, must not leak");
  });
  app.post(
    "/__test/validated",
    {
      schema: {
        body: {
          type: "object",
          required: ["title"],
          properties: { title: { type: "string", minLength: 1, maxLength: 200 } }
        }
      }
    },
    async () => ({ ok: true })
  );

  return app;
}

test("未知路徑：統一結構 404，含 requestId，不含 details／堆疊", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/no-such-path" });

  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.code, "E_NOT_FOUND");
  assert.equal(typeof body.requestId, "string");
  assert.ok(body.requestId.length > 0);
  assert.equal("details" in body, false);
  const raw = response.payload;
  assert.equal(/stack|at .*\.ts:/i.test(raw), false);

  await app.close();
});

test("AppError(E_VALIDATION)：400，details 逐欄一致（code/message/details/requestId）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/__test/app-error" });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(Object.keys(response.json()).sort(), ["code", "details", "message", "requestId"]);
  const body = response.json();
  assert.equal(body.code, "E_VALIDATION");
  assert.equal(body.message, "title must not be empty after trimming");
  assert.deepEqual(body.details, { field: "title", rule: "minLength" });
  assert.equal(typeof body.requestId, "string");

  await app.close();
});

test("AppError(E_NOT_FOUND)：404，無 details 欄位", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/__test/not-found-error" });

  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.deepEqual(Object.keys(body).sort(), ["code", "message", "requestId"]);
  assert.equal(body.code, "E_NOT_FOUND");
  assert.equal(body.message, "Todo not found");

  await app.close();
});

test("未預期例外：500 固定訊息 Internal Server Error，不洩漏例外訊息／堆疊／SQL", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/__test/boom" });

  assert.equal(response.statusCode, 500);
  const body = response.json();
  assert.deepEqual(body, { code: "E_INTERNAL", message: "Internal Server Error", requestId: body.requestId });
  const raw = response.payload;
  assert.equal(raw.includes("ECONNREFUSED"), false);
  assert.equal(raw.toLowerCase().includes("leak"), false);
  assert.equal(/stack|at .*\.ts:/i.test(raw), false);

  await app.close();
});

test("Fastify schema 驗證失敗：400 E_VALIDATION，details 只含欄位與規則，不回射輸入原文", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/__test/validated",
    payload: { title: "" }
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.code, "E_VALIDATION");
  assert.equal(typeof body.requestId, "string");
  assert.equal(body.details?.field, "title");
  assert.equal(body.details?.rule, "minLength");

  await app.close();
});

test("requestId 與 pino 的 reqId 為同一值（NFR-005）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/__test/not-found-error" });
  const body = response.json();

  // Fastify 的 request.id 即 pino 子日誌所綁定的 reqId（同一個值，非另外生成）。
  assert.equal(typeof body.requestId, "string");
  assert.match(body.requestId, /^req-/);

  await app.close();
});
