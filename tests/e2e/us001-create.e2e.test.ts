/**
 * tests/e2e/us001-create.e2e.test.ts
 * T-0021（qa-at）：US-001 新增待辦，e2e 層級 P0 TC。
 *
 * 已知工具限制（dev-tl 交接檔 20260919-1130-T0017-r1）：瀏覽器自動化工具
 * 的合成 Enter 鍵不觸發 HTML form 的 implicit submission（連原生對照表單
 * 也一樣），因此「輸入框按 Enter 送出新增」需真人手動補驗，本檔不測。
 * 本檔一律以滑鼠點擊「新增」按鈕送出（AC-008-2 本就寫明滑鼠與文字輸入）。
 */
import { expect, test } from "@playwright/test";

import { apiClearAll } from "./lib/api-helper.js";

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-008：前端新增後不重整即出現於清單", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("add-todo-input").fill("買牛奶");
  const urlBefore = page.url();
  await page.getByTestId("add-todo-submit").click();

  const item = page.getByTestId("todo-item").filter({ hasText: "買牛奶" });
  await expect(item).toBeVisible();
  await expect(item.getByTestId("todo-item-toggle")).not.toBeChecked();
  expect(page.url()).toBe(urlBefore);
});

test("TC-009：前端空白標題顯示可讀錯誤且不建立", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.getByTestId("todo-item")).toHaveCount(0);

  await page.getByTestId("add-todo-input").fill("   ");
  await page.getByTestId("add-todo-submit").click();

  await expect(page.getByTestId("error-message")).toBeVisible();
  await expect(page.getByTestId("error-message")).not.toBeEmpty();
  await expect(page.getByTestId("todo-item")).toHaveCount(0);
  expect(consoleErrors, `console 應無 error：${consoleErrors.join(" | ")}`).toHaveLength(0);
});

test("TC-010：前端超長標題顯示長度錯誤訊息", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("add-todo-input");
  // maxlength=200 會擋掉鍵盤輸入超過 200 字元，故先移除屬性以模擬「以其他
  // 方式繞過前端 UI 限制送出超長字串」的情境（與 dev-tl 交接檔實測手法一致）。
  await input.evaluate((el: HTMLInputElement) => el.removeAttribute("maxlength"));
  await input.fill("a".repeat(201));
  await page.getByTestId("add-todo-submit").click();

  await expect(page.getByTestId("error-message")).toBeVisible();
  await expect(page.getByTestId("todo-item")).toHaveCount(0);
});

test("TC-011：新增成功後輸入框清空可直接輸入下一筆", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("add-todo-input");

  await input.fill("第一筆");
  await page.getByTestId("add-todo-submit").click();
  await expect(page.getByTestId("todo-item").filter({ hasText: "第一筆" })).toBeVisible();
  await expect(input).toHaveValue("");

  await input.fill("第二筆");
  await page.getByTestId("add-todo-submit").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(2);
});
