/**
 * tests/e2e/us009-same-origin.e2e.test.ts
 * T-0021（qa-at）：TC-075（AC-009-5 特殊判準 b）——前端請求與頁面同源
 * 且無 OPTIONS 預檢。
 */
import { expect, test } from "@playwright/test";

import { apiClearAll } from "./lib/api-helper.js";

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-075：/api/v1/* 請求與頁面同源，且不含任何 OPTIONS 預檢", async ({ page }) => {
  const apiRequests: { url: string; method: string }[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) {
      apiRequests.push({ url: request.url(), method: request.method() });
    }
  });

  await page.goto("/");
  const pageOrigin = new URL(page.url()).origin;

  await page.getByTestId("add-todo-input").fill("TC-075：同源測試");
  await page.getByTestId("add-todo-submit").click();
  await expect(page.getByTestId("todo-item").filter({ hasText: "TC-075：同源測試" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("todo-item").filter({ hasText: "TC-075：同源測試" }).getByTestId("todo-item-delete").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(0);

  expect(apiRequests.length).toBeGreaterThan(0);
  for (const req of apiRequests) {
    expect(new URL(req.url).origin).toBe(pageOrigin);
    expect(req.method).not.toBe("OPTIONS");
  }
});
