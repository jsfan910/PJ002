/**
 * tests/e2e/us002-list.e2e.test.ts
 * T-0021（qa-at）：US-002 檢視待辦清單，e2e 層級 P0 TC。
 */
import { expect, test } from "@playwright/test";

import { apiClearAll, apiCreate } from "./lib/api-helper.js";

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-016：清單頁每筆顯示標題、完成狀態、建立時間", async ({ page }) => {
  await apiCreate("TC-016：第一筆");
  await apiCreate("TC-016：第二筆");
  await apiCreate("TC-016：第三筆");

  await page.goto("/");
  const items = page.getByTestId("todo-item");
  await expect(items).toHaveCount(3);

  const count = await items.count();
  for (let i = 0; i < count; i += 1) {
    const item = items.nth(i);
    await expect(item.getByTestId("todo-item-title")).not.toBeEmpty();
    await expect(item.getByTestId("todo-item-toggle")).toBeVisible();
    await expect(item.getByTestId("todo-item-created-at")).not.toBeEmpty();
  }
});

test("TC-017：空清單顯示可讀提示且不顯示錯誤", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByTestId("error-message")).toBeHidden();
  expect(consoleErrors).toHaveLength(0);
});

test("TC-018：重新整理後資料仍在（持久化）", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("add-todo-input").fill("TC-018：第一筆");
  await page.getByTestId("add-todo-submit").click();
  // 等第一筆的新增（POST + 重新整份取清單）完全落地後才送第二筆：兩次新增
  // 幾乎同時送出時，先送出者的重新整份 GET 若晚於第二筆的 GET 才回應，會用
  // 較舊（只有 1 筆）的清單覆蓋較新狀態——這是前端目前「整份重新取代」
  // 策略在快速連續操作下的已知風險，非本 TC（重整後持久化）驗證範圍，故
  // 在此以等待避免誤觸發；該風險已記入 AT 報告「下一步建議」交 qa-lead。
  await expect(page.getByTestId("todo-item").filter({ hasText: "TC-018：第一筆" })).toBeVisible();
  await page.getByTestId("add-todo-input").fill("TC-018：第二筆");
  await page.getByTestId("add-todo-submit").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(2);

  await page.reload();

  await expect(page.getByTestId("todo-item")).toHaveCount(2);
  await expect(page.getByTestId("todo-item").filter({ hasText: "TC-018：第一筆" })).toBeVisible();
  await expect(page.getByTestId("todo-item").filter({ hasText: "TC-018：第二筆" })).toBeVisible();
});
