/**
 * tests/e2e/us003-edit.e2e.test.ts
 * T-0021（qa-at）：US-003 編輯待辦，e2e 層級 P0 TC。
 *
 * 注意：一旦點擊「編輯」，該筆 `<li>` 的內容會整段換成
 * `todo-item-edit-form`（含 `<input>`），原本的標題文字不再出現在
 * `textContent` 中（`<input>` 的 value 不算 textContent）。因此進入編輯
 * 模式後，改用 `page.getByTestId("todo-item-edit-input"/...)`（全頁面
 * 唯一，因為同時只會有一筆處於編輯狀態）取代 `item.getByTestId(...)` 的
 * 鏈式寫法，避免 `.filter({hasText})` 因文字消失而失效。
 */
import { expect, test } from "@playwright/test";

import { apiClearAll, apiCreate, apiDelete } from "./lib/api-helper.js";

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-026：前端編輯儲存後不重整即見新標題", async ({ page }) => {
  await apiCreate("舊標題");
  await page.goto("/");

  const item = page.getByTestId("todo-item").filter({ hasText: "舊標題" });
  await item.getByTestId("todo-item-edit").click();
  await page.getByTestId("todo-item-edit-input").fill("新標題");
  const urlBefore = page.url();
  await page.getByTestId("todo-item-edit-save").click();

  await expect(page.getByTestId("todo-item").filter({ hasText: "新標題" })).toBeVisible();
  await expect(page.getByTestId("todo-item-edit-form")).toHaveCount(0);
  expect(page.url()).toBe(urlBefore);
});

test("TC-027：前端清空標題儲存顯示錯誤且原標題保留", async ({ page }) => {
  await apiCreate("舊標題");
  await page.goto("/");

  const item = page.getByTestId("todo-item").filter({ hasText: "舊標題" });
  await item.getByTestId("todo-item-edit").click();
  await page.getByTestId("todo-item-edit-input").fill("   ");
  await page.getByTestId("todo-item-edit-save").click();

  await expect(page.getByTestId("error-message")).toBeVisible();
  await expect(page.getByTestId("todo-item").filter({ hasText: "舊標題" })).toBeVisible();
});

test("TC-028：前端取消編輯回復原標題並離開編輯狀態", async ({ page }) => {
  await apiCreate("舊標題");
  await page.goto("/");

  const item = page.getByTestId("todo-item").filter({ hasText: "舊標題" });
  await item.getByTestId("todo-item-edit").click();
  await page.getByTestId("todo-item-edit-input").fill("亂改的");
  await page.getByTestId("todo-item-edit-cancel").click();

  await expect(page.getByTestId("todo-item").filter({ hasText: "舊標題" })).toBeVisible();
  await expect(page.getByTestId("todo-item-edit-form")).toHaveCount(0);
});

test("TC-029：前端編輯已被刪除的待辦顯示可讀錯誤", async ({ page }) => {
  const todo = await apiCreate("待被刪除");
  await page.goto("/");

  const item = page.getByTestId("todo-item").filter({ hasText: "待被刪除" });
  await item.getByTestId("todo-item-edit").click();

  await apiDelete(todo.id); // 背景以 API 刪除（模擬另一個用戶端）

  await page.getByTestId("todo-item-edit-input").fill("新標題");
  await page.getByTestId("todo-item-edit-save").click();

  await expect(page.getByTestId("error-message")).toBeVisible();
  await expect(page.locator("body")).not.toBeEmpty();
});
