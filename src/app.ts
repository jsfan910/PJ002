/**
 * src/app.ts（BE-01）
 *
 * 組裝 Fastify 實例與外掛註冊順序。順序錯了會造成安全漏洞（靜態檔不設防），
 * 硬前提 8／SD §8.1／WBS §5：五個註冊位置錨點，**順序不可調換**，
 * 每張後續卡只在自己的錨點插入一行 `app.register(...)`，不得改動其他行。
 *
 * 外掛註冊順序（SD §8.1）：
 *   1. error-handler（BE-03，WI-02）—— 最先，之後任何一步拋錯都被它接住
 *   2. basic-auth 全域 hook（BE-02，WI-05）—— 必須早於 static 與 routes
 *   3. health 路由（BE-07，本卡）
 *   4. static（BE-09，WI-05）
 *   5. todos 路由（BE-04，WI-06）
 *   6.（P1）jwt-guard（BE-13）取代第 2 步；auth 路由（BE-10）
 */
import Fastify, { type FastifyInstance } from "fastify";

import type { AppConfig } from "./config.js";
import registerErrorHandler from "./plugins/error-handler.js";
import healthRoutes from "./routes/health.js";

export function buildApp(config: AppConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      // BR-016／06_*.md §4「禁止事項」：Basic Auth 標頭永不落日誌。
      // 此設定只能在 Fastify 建構時指定，故由本卡（app.ts 骨架）一次寫入，
      // 不等 WI-02／WI-05 到位；不影響各卡在自己錨點插入的註冊順序。
      redact: ["req.headers.authorization"]
    }
  });

  // [ANCHOR:error-handler]   ← WI-02 於此註冊 BE-03（必須最先）
  registerErrorHandler(app);
  // [ANCHOR:auth]            ← WI-05 於此註冊 BE-02 全域 hook（必須早於 static 與 routes）
  app.register(healthRoutes); // WI-01 註冊 BE-07
  // [ANCHOR:static]          ← WI-05 於此註冊 BE-09
  // [ANCHOR:routes]          ← WI-06 於此註冊 BE-04
  // [ANCHOR:p1-auth-routes]  ← P1：BE-10；並由 BE-13 取代 [ANCHOR:auth]

  return app;
}
