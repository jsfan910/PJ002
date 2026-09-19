/**
 * tests/e2e/playwright.config.ts
 *
 * T-0021（qa-at）：E2E 設定。`@playwright/test` 已於 dev-tl 合併本卡時正式列入
 * `package.json` devDependencies 並釘選 `1.63.0`（Leader 裁決
 * 2026-09-19T12:32:40+08:00）；`npm ci` 之後另需 `npx playwright install chromium`
 * 下載瀏覽器二進位檔。執行方式：`npm run test:e2e`（等同
 * `npx playwright test -c tests/e2e/playwright.config.ts`），指定 project 用
 * `npm run test:e2e -- --project=chromium-1280x800`。
 *
 * `baseURL` 讀 `$BASE_URL`（本機 docker compose 預設 `http://localhost:8080`）；
 * `httpCredentials` 從環境變數讀，不寫死字面值（07 §6.2 資料衛生規則）。
 * 依 traceability／07 §7 R-5，NFR-004「最新版即可」：本輪至少跑 Chromium，
 * 若環境有 Edge／Firefox 則一併跑（見下方 projects），無則該組記「阻擋
 * （環境未就緒）」，不影響 Chromium 組的判定。
 */
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const USER = process.env.STAGING_BASIC_AUTH_USER ?? process.env.BASIC_AUTH_USER ?? "dev";
const PASSWORD = process.env.STAGING_BASIC_AUTH_PASSWORD ?? process.env.BASIC_AUTH_PASSWORD ?? "dev";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.e2e\.test\.ts/,
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    httpCredentials: { username: USER, password: PASSWORD },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // T-0028（qa-at r3，環境差異小修）：對 staging（Cloud Run／Google Frontend）
    // 導覽時，Chromium／Edge 走 HTTP/2／QUIC 在本執行環境下會 net::ERR_ABORTED
    // 逾時（curl／node fetch 對同一網址皆正常 200，只有瀏覽器的 HTTP/2／QUIC
    // 交涉在本沙盒卡住；`page.goto` 只需 --disable-http2 即可修復，但
    // `page.reload()` 仍逾時，需同時加 --disable-quic 才穩定，已用最小重現
    // 腳本連續 3 次驗證皆成功）。對本機 docker compose（HTTP/1.1）無影響。
    // 詳見交接檔。
    launchOptions: { args: ["--disable-http2", "--disable-quic"] }
  },
  projects: [
    {
      name: "chromium-1280x800",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } }
    },
    {
      name: "chromium-390x844",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } }
    },
    {
      name: "msedge-1280x800",
      use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1280, height: 800 } }
    },
    {
      name: "msedge-390x844",
      use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 390, height: 844 } }
    },
    {
      name: "firefox-1280x800",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 } }
    },
    {
      name: "firefox-390x844",
      use: { ...devices["Desktop Firefox"], viewport: { width: 390, height: 844 } }
    }
  ]
});
