/**
 * src/plugins/static.ts（BE-09）
 *
 * `@fastify/static` 供應 `public/`：`GET /` 回 `index.html`，
 * `GET /assets/*` 回對應檔（SD §3.1 BE-09、SD §8.1 目錄結構）。
 *
 * 註冊順序上必須排在 `[ANCHOR:auth]` 之後（硬前提 8、SD §8.1）：本檔本身
 * 不判斷是否已認證，完全依賴 basic-auth（BE-02）的全域 hook 先行擋下未
 * 帶憑證的請求，因此靜態檔與 API 一樣受保護（SD §6.2 CR 判準：未帶憑證
 * 取 `public/` 下的資產必須同樣回 401）。
 *
 * 找不到檔案時呼叫 `reply.callNotFound()`（外掛內建行為），交由 WI-02
 * 的全域 `setNotFoundHandler` 產生統一 404 結構，本檔不另外處理 404。
 *
 * 快取：明確關閉，避免受保護的靜態內容被中介快取（proxy／CDN）保留下來，
 * 讓之後未帶憑證的請求也能取得同一份回應本文（等同繞過 Basic Auth 的
 * 快取洩漏風險）。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
// 編譯後本檔位於 dist/plugins/static.js，public/ 與 dist/ 是同層的兩個
// 目錄（Dockerfile 兩階段皆各自 COPY public ./public，見 T-0014 交接檔），
// 因此往上兩層即可回到專案根目錄。
const PUBLIC_ROOT = path.resolve(currentDir, "..", "..", "public");

/**
 * 於 src/app.ts 的 `[ANCHOR:static]` 直接呼叫（不經巢狀 app.register 另建
 * 子情境，維持與 basic-auth／error-handler 一致的呼叫風格；`@fastify/static`
 * 會在其自身的巢狀情境內註冊 `GET /` 與 `GET /*` 路由，但這些路由仍會
 * 繼承掛在根實例上的 basic-auth hook，因為 Fastify 的 hook 繼承是父→子
 * 單向的，不受此處是否巢狀影響）。
 */
export function registerStatic(app: FastifyInstance): void {
  app.register(fastifyStatic, {
    root: PUBLIC_ROOT,
    prefix: "/",
    index: ["index.html"],
    cacheControl: false,
    etag: false,
    lastModified: false,
    setHeaders(reply) {
      reply.header("Cache-Control", "no-store, private");
    }
  });
}

export default registerStatic;
