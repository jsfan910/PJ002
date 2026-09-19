/**
 * tests/integration/startup-migrate.test.ts
 *
 * CR B-2 回歸測試：`05_資料庫設計.md` §3「migration runner」第 4 條要求
 * migration 於**應用啟動時自動執行**（NFR-008）。修正前 `src/server.ts`
 * 從未呼叫 `runMigrations`，對一個尚未套用任何 migration 的資料庫啟動後，
 * `GET /api/v1/todos` 回 500（`relation "todos" does not exist`）。本檔
 * 以與 `src/server.ts` **完全相同的啟動路徑**（匯入並呼叫其匯出的
 * `start()`）驗證：啟動後同一請求必須是 200 `[]`，不得是 500。
 *
 * 隔離方式：本機／CI 的 Postgres 服務由其他整合測試檔（例如
 * `todos-api.test.ts`）共用，可能同時執行；若直接對共用的
 * `public.todos` 做 DROP 會與它們互撞。因此本檔改用專屬的 Postgres
 * **schema**（`startup_migrate_test`），透過 `DATABASE_URL` 的
 * `options=-c search_path=<schema>` 讓 `runMigrations`／
 * `todo-repository` 內未加 schema 前綴的 `todos`／`schema_migrations`
 * 都落在這個隔離 schema 裡，每次測試前整個 DROP／CREATE 一次，確保是
 * 「尚未套用任何 migration」的乾淨狀態，且完全不觸碰 `public` schema。
 *
 * 無 DB 環境時整批 skip（沿用 `tests/integration/todo-repository.test.ts`
 * 的既有慣例：探測不到就 skip 並印出原因，不假裝通過）。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";

const BASE_DATABASE_URL = process.env.DATABASE_URL ?? "postgres://dev:dev@localhost:5432/todo";
const TEST_SCHEMA = "startup_migrate_test";
const CONNECT_TIMEOUT_MS = 3000;
// 專用埠，避開其他整合測試／平行 worktree 常用的 8080~8099、5432~5433
// （任務卡提示詞「環境」一節：埠若被占用改用其他埠）。
const APP_PORT = Number(process.env.STARTUP_MIGRATE_TEST_PORT ?? 18024);

function withSearchPath(databaseUrl: string, schema: string): string {
  const separator = databaseUrl.includes("?") ? "&" : "?";
  return `${databaseUrl}${separator}options=${encodeURIComponent(`-c search_path=${schema}`)}`;
}

const ISOLATED_DATABASE_URL = withSearchPath(BASE_DATABASE_URL, TEST_SCHEMA);

async function probeDatabase(): Promise<{ available: boolean; reason: string }> {
  const probePool = new Pool({
    connectionString: BASE_DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS
  });
  try {
    await probePool.query("SELECT 1");
    return { available: true, reason: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      reason:
        `無法連線到 DATABASE_URL=${BASE_DATABASE_URL}：${message}` +
        "（本機 Docker daemon 不可用時預期如此；請先 docker compose up -d db 再重跑本檔）"
    };
  } finally {
    await probePool.end().catch(() => undefined);
  }
}

const { available: dbAvailable, reason: skipReason } = await probeDatabase();

if (!dbAvailable) {
  console.log(`[SKIP] tests/integration/startup-migrate.test.ts：${skipReason}`);
}

const skip = dbAvailable ? false : skipReason;

process.env.NODE_ENV ??= "test";
process.env.BASIC_AUTH_USER ??= "test";
process.env.BASIC_AUTH_PASSWORD ??= "test";
process.env.LOG_LEVEL ??= "silent";

async function resetIsolatedSchema(): Promise<void> {
  const adminPool = new Pool({ connectionString: BASE_DATABASE_URL, max: 1 });
  try {
    // CASCADE：確保即使上一輪測試留下 todos／schema_migrations 以外的
    // 物件，也能連同 schema 一次清空，回到「完全沒套用過任何 migration」
    // 的狀態。
    await adminPool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await adminPool.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
  } finally {
    await adminPool.end();
  }
}

test(
  "以與 src/server.ts 相同的啟動路徑（start()）啟動，對未套用 migration 的資料庫，GET /api/v1/todos 回 200 []（CR B-2，非 500）",
  { skip },
  async () => {
    await resetIsolatedSchema();

    // 讓 start() 內部的 loadConfig() 讀到隔離 schema 與專用埠。
    process.env.PORT = String(APP_PORT);
    process.env.DATABASE_URL = ISOLATED_DATABASE_URL;

    const { start } = await import("../../dist/server.js");
    const app = await start();

    try {
      const authHeader = `Basic ${Buffer.from(
        `${process.env.BASIC_AUTH_USER}:${process.env.BASIC_AUTH_PASSWORD}`,
        "utf-8"
      ).toString("base64")}`;

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/todos",
        headers: { authorization: authHeader }
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), []);
    } finally {
      await app.close();
      await resetIsolatedSchema();
    }
  }
);
