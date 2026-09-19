/**
 * tests/integration/auth-basic.test.ts
 *
 * 全站 Basic Auth（BE-02）與靜態託管（BE-09）的整合測試（WBS §1.5、
 * SD §6.2、ADR-0004）。沿用 tests/integration/health.test.ts／
 * error-contract.test.ts 的寫法：匯入 `../../dist/...`（已編譯產物），
 * `app.inject()` 不開真實 TCP，跑本測試前必須先 `npm run build`。
 *
 * 覆蓋重點：
 * - 未帶／錯誤憑證一律 401，且錯誤本文符合 04_API規格.yaml 的 Error
 *   schema（code/message/requestId，additionalProperties: false）。
 * - 正確憑證放行（health 路由既有、靜態資產、以及模擬 WI-06 尚未存在時
 *   的一般路徑）。
 * - `/health` 唯一豁免：pathname 完全相等比對，含查詢字串與尾斜線兩種
 *   情況（R-08：比對 req.url 而非 pathname 會讓帶查詢字串的請求誤判為
 *   401；尾斜線 `/health/` 不等於 `/health`，仍須受保護，證明比對是
 *   完全相等而非前綴）。
 * - `/healthz-secret`（禁止前綴比對）與一般路徑皆須受保護。
 * - 靜態資產（`/`、`/styles.css`、`/assets/api-client.js`）受保護且在
 *   帶正確憑證時可正確回應內容。
 * - `WWW-Authenticate: Basic realm="staging"` 標頭存在。
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

const USER = process.env.BASIC_AUTH_USER;
const PASSWORD = process.env.BASIC_AUTH_PASSWORD;

function basicAuthHeader(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`, "utf-8").toString("base64")}`;
}

const VALID_AUTH_HEADER = basicAuthHeader(USER, PASSWORD);

function buildTestApp() {
  return buildApp(loadConfig());
}

test("未帶憑證取 / 回 401", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/" });

  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.code, "E_UNAUTHORIZED");
  assert.equal(typeof body.message, "string");
  assert.equal(typeof body.requestId, "string");
  assert.ok(body.requestId.length > 0);
  assert.deepEqual(Object.keys(body).sort(), ["code", "message", "requestId"]);

  await app.close();
});

test("錯誤憑證取 / 回 401，且不含任何業務資料", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/",
    headers: { authorization: basicAuthHeader("wrong-user", "wrong-password") }
  });

  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.code, "E_UNAUTHORIZED");
  assert.equal(response.payload.includes("todo"), false);

  await app.close();
});

test("401 回應附 WWW-Authenticate: Basic realm=staging", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/" });

  assert.equal(response.statusCode, 401);
  const header = response.headers["www-authenticate"];
  assert.equal(typeof header, "string");
  assert.match(String(header), /^Basic realm="staging"/);

  await app.close();
});

test("正確憑證取 / 回 200 並回 index.html 內容", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/",
    headers: { authorization: VALID_AUTH_HEADER }
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.payload, /<html/i);

  await app.close();
});

test("GET /health 未帶憑證仍回 200（唯一豁免路徑）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });

  await app.close();
});

test("GET /health?cb=1 未帶憑證仍回 200（比對 pathname 而非 req.url，R-08）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/health?cb=1" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });

  await app.close();
});

test("GET /health/ 未帶憑證回 401（尾斜線不等於 /health，比對為完全相等）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/health/" });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test("GET /healthz-secret 未帶憑證回 401（禁止前綴比對）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/healthz-secret" });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test("未帶憑證取靜態資產 /assets/api-client.js 回 401（靜態檔同樣受保護）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/assets/api-client.js" });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test("正確憑證取靜態資產 /assets/api-client.js 回 200", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/assets/api-client.js",
    headers: { authorization: VALID_AUTH_HEADER }
  });

  assert.equal(response.statusCode, 200);

  await app.close();
});

test("正確憑證取靜態資產 /styles.css 回 200，且不設可被中介快取的 Cache-Control", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/styles.css",
    headers: { authorization: VALID_AUTH_HEADER }
  });

  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers["cache-control"]), /no-store/);

  await app.close();
});

test("未知路徑（非 /health）未帶憑證回 401，而非走到 404（auth 早於 not-found）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/no-such-path" });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test("正確憑證取不存在的靜態資產回統一 404 結構（走全域 not-found，非自訂）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/no-such-asset.js",
    headers: { authorization: VALID_AUTH_HEADER }
  });

  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.code, "E_NOT_FOUND");
  assert.equal(typeof body.requestId, "string");

  await app.close();
});
