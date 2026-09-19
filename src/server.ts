/**
 * src/server.ts（BE-01）
 *
 * 啟動、migration、監聽、優雅關機。Cloud Run 會注入 PORT（預設 8080），
 * 一律讀 config.port，不得寫死埠號（ADR-0005）。監聽 0.0.0.0 讓容器內
 * 對外可達。
 *
 * CR B-2：`05_資料庫設計.md` §3「migration runner」第 4 條明文「於應用
 * 啟動時自動執行」（NFR-008：使用者不需手動下 migration 指令）。在
 * `app.listen` 之前呼叫 `runMigrations`，失敗即記錄原因後以非 0 結束
 * （部署工作流的獨立 migrate 階段作為雙重保險，不移除，見任務卡背景）。
 *
 * 啟動邏輯抽成可匯入的 `start()`（回傳建好且已 listen 的 app 實例），供
 * `tests/integration/startup-migrate.test.ts` 以與本檔相同的啟動路徑
 * 驗證「對未套用 migration 的資料庫啟動後不得 500」。只有被當成 CLI
 * 腳本直接執行時才自動呼叫（沿用 `src/db/migrate.ts` 的 `isMainModule`
 * 寫法），被測試 import 時不觸發非預期的 side effect（真正監聽埠、
 * 註冊 SIGTERM/SIGINT）。
 */
import { pathToFileURL } from "node:url";

import type { FastifyInstance } from "fastify";

import { buildApp } from "./app.js";
import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { createPool } from "./db/pool.js";

/**
 * 以 config 的 DATABASE_URL 另建一個專用於 migration 的連線池，跑完即關閉
 * （不沿用 routes/todos.ts 那個服務生命週期的池，兩者職責不同、互不影響）。
 * 失敗時記錄原因（原始錯誤物件，含訊息）後以非 0 結束整個程序。
 */
async function applyMigrationsOrExit(app: FastifyInstance, config: AppConfig): Promise<void> {
  const migrationPool = createPool(config);
  let migrationError: unknown;
  try {
    await runMigrations(migrationPool);
  } catch (err) {
    migrationError = err;
  } finally {
    await migrationPool.end().catch(() => undefined);
  }

  if (migrationError !== undefined) {
    app.log.error(migrationError, "啟動時套用 migration 失敗，服務不會啟動監聽");
    process.exit(1);
  }
}

export async function start(): Promise<FastifyInstance> {
  const config = loadConfig();
  const app = buildApp(config);

  await applyMigrationsOrExit(app, config);

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  async function shutdown(signal: string): Promise<void> {
    app.log.info(`收到 ${signal}，開始優雅關機`);
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  return app;
}

/** 只有被當成 CLI 腳本直接執行時才自動跑；被測試 import 時不觸發。
 *  寫法與 src/db/migrate.ts 一致。 */
const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void start();
}
