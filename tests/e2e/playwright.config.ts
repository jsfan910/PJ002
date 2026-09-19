/**
 * tests/e2e/playwright.config.ts
 *
 * T-0021（qa-at）：E2E 設定。**不改 package.json**——本卡在 worktree 內以
 * `npm install --no-save --no-package-lock @playwright/test` 臨時安裝
 * （見交接檔「需要 Leader 裁決的事」：套件版本與是否正式併入交 dev-tl 合併
 * 時決定）。執行方式：`npx playwright test -c tests/e2e/playwright.config.ts`。
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
    trace: "retain-on-failure"
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
