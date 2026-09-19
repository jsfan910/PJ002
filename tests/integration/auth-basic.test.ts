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
 * - `/health` 唯一豁免：對請求原文做完全相等比對，含查詢字串與尾斜線兩種
 *   情況（R-08：比對 req.url 而非剝除查詢字串後的原文會讓帶查詢字串的
 *   請求誤判為 401；尾斜線 `/health/` 不等於 `/health`，仍須受保護，
 *   證明比對是完全相等而非前綴）。
 * - `/healthz-secret`（禁止前綴比對）與一般路徑皆須受保護。
 * - CR B-1：豁免比對禁止任何路徑正規化，四個點節段變體
 *   （`/foo/../health`、`/.%2e/health`、`/%2e%2e/health`、
 *   `/assets/%2e%2e/%2e%2e/health`）未帶憑證皆須回 401，即使它們的
 *   `new URL(...).pathname` 正規化結果等於 `/health`。**這四個變體不能
 *   用 `app.inject()` 驗證**：`app.inject()` 底層的 `light-my-request`
 *   在建構模擬請求時自己就會先 `new URL(url, base)` 再取
 *   `pathname + search` 寫回 `request.url`（見
 *   `node_modules/light-my-request/lib/request.js`／`parse-url.js`），
 *   等同於在測試框架層面把點節段先正規化掉，讓 `basic-auth.ts` 收到的
 *   `request.url` 已經是 `/health`——不管我們自己的比對函式寫得多正確，
 *   inject 版本永遠會誤判成「豁免命中」而回 200（實測驗證過）。CR
 *   報告本身也是用真實 curl（`--path-as-is`，不開任何用戶端正規化）
 *   重現，而非 `app.inject()`。因此這四個測試改為 `app.listen()` 開一個
 *   真實 TCP 埠，用 `node:http` 直接送出未經任何函式庫正規化的原始
 *   request-target（驗證過 `http.request({path})` 會逐字送出，不正規化）。
 * - CR S-2：豁免只適用 GET／HEAD，`POST /health` 未帶憑證回 401。
 * - 靜態資產（`/`、`/styles.css`、`/assets/api-client.js`）受保護且在
 *   帶正確憑證時可正確回應內容。
 * - `WWW-Authenticate: Basic realm="staging"` 標頭存在。
 */
import assert from "node:assert/strict";
import http from "node:http";
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

interface RawResponse {
  statusCode: number;
  body: string;
}

/**
 * 對「未經任何函式庫正規化」的原始 request-target 送出真實 TCP 請求
 * （CR B-1 的四個點節段變體只能這樣驗證，見檔頭說明）。`http.request`
 * 的 `path` 選項會逐字送出，不像 `app.inject()` 會先 `new URL()`。
 */
async function rawRequest(port: number, method: string, rawPath: string): Promise<RawResponse> {
  return await new Promise<RawResponse>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: rawPath }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => {
        body += chunk.toString("utf-8");
      });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

/** 開一個真實 TCP 埠（listen port 0 讓 OS 挑空埠，避免與其他平行作業撞埠）。 */
async function listenTestApp(): Promise<{ app: ReturnType<typeof buildTestApp>; port: number }> {
  const app = buildTestApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("app.listen() 之後預期取得 AddressInfo，實際：" + String(address));
  }
  return { app, port: address.port };
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

test("GET /health?cb=1 未帶憑證仍回 200（比對剝除查詢字串後的原文，非 req.url，R-08）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/health?cb=1" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });

  await app.close();
});

test("GET /health?x=1 未帶憑證仍回 200（CR B-1 驗收：查詢字串不影響豁免）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/health?x=1" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });

  await app.close();
});

for (const dotSegmentVariant of [
  "/foo/../health",
  "/.%2e/health",
  "/%2e%2e/health",
  "/assets/%2e%2e/%2e%2e/health"
]) {
  test(
    `GET ${dotSegmentVariant}（真實 TCP，未經任何函式庫正規化）未帶憑證回 401（CR B-1：` +
      "禁止路徑正規化，其 new URL().pathname 正規化結果等於 /health 但請求原文不等於，仍須認證）",
    async () => {
      const { app, port } = await listenTestApp();

      try {
        const response = await rawRequest(port, "GET", dotSegmentVariant);

        assert.equal(response.statusCode, 401);
        assert.equal(JSON.parse(response.body).code, "E_UNAUTHORIZED");
      } finally {
        await app.close();
      }
    }
  );
}

test("POST /health 未帶憑證回 401（CR S-2：豁免只適用 GET／HEAD）", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "POST", url: "/health" });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, "E_UNAUTHORIZED");

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
