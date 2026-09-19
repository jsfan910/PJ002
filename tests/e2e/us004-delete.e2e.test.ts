/**
 * tests/e2e/us004-delete.e2e.test.ts
 * T-0021（qa-at）：US-004 刪除待辦，e2e 層級 P0 TC。
 *
 * 二次確認以 `page.on("dialog", ...)` 注入回應（等同 dev-tl 交接檔提醒的
 * `window.confirm` 注入手法；Playwright 預設會自動 dismiss 對話框，必須
 * 主動監聽才能改為 accept）。
 */
import { expect, test } from "@playwright/test";

import { apiClearAll, apiCreate, apiDelete } from "./lib/api-helper.js";

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-034：前端刪除並確認後該筆消失且不重整", async ({ page }) => {
  await apiCreate("TC-034：A");
  await apiCreate("TC-034：B");
  await apiCreate("TC-034：C");
  await page.goto("/");
  await expect(page.getByTestId("todo-item")).toHaveCount(3);

  page.once("dialog", (dialog) => dialog.accept());
  const urlBefore = page.url();
  await page.getByTestId("todo-item").filter({ hasText: "TC-034：B" }).getByTestId("todo-item-delete").click();

  await expect(page.getByTestId("todo-item")).toHaveCount(2);
  await expect(page.getByTestId("todo-item").filter({ hasText: "TC-034：B" })).toHaveCount(0);
  expect(page.url()).toBe(urlBefore);
});

test("TC-035：確認提示選取消則該筆保留", async ({ page }) => {
  await apiCreate("TC-035：A");
  await apiCreate("TC-035：B");
  await apiCreate("TC-035：C");
  await page.goto("/");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("todo-item").filter({ hasText: "TC-035：B" }).getByTestId("todo-item-delete").click();

  await expect(page.getByTestId("todo-item")).toHaveCount(3);
  await page.reload();
  await expect(page.getByTestId("todo-item")).toHaveCount(3);
});

test("TC-036：刪除後重新整理仍不出現", async ({ page }) => {
  await apiCreate("TC-036：A");
  await apiCreate("TC-036：B");
  await apiCreate("TC-036：C");
  await page.goto("/");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("todo-item").filter({ hasText: "TC-036：A" }).getByTestId("todo-item-delete").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(2);

  await page.reload();
  await expect(page.getByTestId("todo-item")).toHaveCount(2);
  await expect(page.getByTestId("todo-item").filter({ hasText: "TC-036：A" })).toHaveCount(0);
});

test("TC-037：刪除已被刪除的待辦不產生系統錯誤畫面", async ({ page }) => {
  const todo = await apiCreate("TC-037：待刪除");
  await page.goto("/");

  const item = page.getByTestId("todo-item").filter({ hasText: "TC-037：待刪除" });
  await apiDelete(todo.id); // 背景已被刪除

  page.once("dialog", (dialog) => dialog.accept());
  await item.getByTestId("todo-item-delete").click();

  await expect(page.getByTestId("error-message")).toBeVisible();
  await expect(page.locator("body")).not.toBeEmpty();
});
