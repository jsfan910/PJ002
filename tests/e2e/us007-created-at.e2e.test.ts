/**
 * tests/e2e/us007-created-at.e2e.test.ts
 * T-0021（qa-at）：US-007 顯示建立時間，e2e 層級 P0 TC。
 */
import { expect, test } from "@playwright/test";

import { apiClearAll, apiCreate } from "./lib/api-helper.js";

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-063：前端以本地時區顯示 yyyy-mm-dd HH:mm 且非相對時間", async ({ page }) => {
  await apiCreate("TC-063：時間顯示");
  await page.goto("/");

  const text = await page.getByTestId("todo-item-created-at").innerText();
  expect(text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  expect(text).not.toMatch(/前|後|ago|分鐘|小時/);
});

test("TC-064：前端編輯／切換後顯示的建立時間不變", async ({ page }) => {
  await apiCreate("TC-064：原標題");
  await page.goto("/");

  const item = page.getByTestId("todo-item").filter({ hasText: "TC-064：原標題" });
  const before = await item.getByTestId("todo-item-created-at").innerText();

  await item.getByTestId("todo-item-edit").click();
  await page.getByTestId("todo-item-edit-input").fill("TC-064：新標題");
  await page.getByTestId("todo-item-edit-save").click();
  await page.getByTestId("todo-item").filter({ hasText: "TC-064：新標題" }).getByTestId("todo-item-toggle").click();

  const after = await page.getByTestId("todo-item").filter({ hasText: "TC-064：新標題" }).getByTestId("todo-item-created-at").innerText();
  expect(after).toBe(before);
});
