/**
 * src/server.ts（BE-01）
 *
 * 啟動、監聽、優雅關機。Cloud Run 會注入 PORT（預設 8080），一律讀
 * config.port，不得寫死埠號（ADR-0005）。監聽 0.0.0.0 讓容器內對外可達。
 */
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = buildApp(config);

async function start(): Promise<void> {
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
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

void start();
