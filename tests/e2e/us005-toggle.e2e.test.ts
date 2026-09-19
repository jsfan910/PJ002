/**
 * tests/e2e/us005-toggle.e2e.test.ts
 * T-0021（qa-at）：US-005 切換完成／未完成，e2e 層級 P0 TC。
 *
 * dev-tl 交接檔提醒（20260919-1130-T0017-r1）：`data-testid="todo-item-toggle"`
 * 掛在 13×13 的 `<input type=checkbox>` 本身，44×44 點擊區在其外層
 * `<label>`；點擊區量測請用 `closest("label")`（本檔不驗尺寸，尺寸見
 * tests/e2e/nfr-compat.e2e.test.ts 的 TC-091）。
 */
import { expect, test } from "@playwright/test";

import { apiClearAll, apiCreate } from "./lib/api-helper.js";

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-045：前端點擊切換為已完成並有可辨識視覺呈現", async ({ page }) => {
  await apiCreate("TC-045：未完成");
  await page.goto("/");

  const item = page.getByTestId("todo-item").filter({ hasText: "TC-045：未完成" });
  const urlBefore = page.url();
  await item.getByTestId("todo-item-toggle").click();

  await expect(item.getByTestId("todo-item-toggle")).toBeChecked();
  const titleEl = item.getByTestId("todo-item-title");
  await expect(titleEl).toHaveCSS("text-decoration-line", "line-through");
  expect(page.url()).toBe(urlBefore);
});

test("TC-046：前端再次點擊切回未完成", async ({ page }) => {
  await apiCreate("TC-046：待切換");
  await page.goto("/");

  const item = page.getByTestId("todo-item").filter({ hasText: "TC-046：待切換" });
  await item.getByTestId("todo-item-toggle").click();
  await expect(item.getByTestId("todo-item-toggle")).toBeChecked();

  await item.getByTestId("todo-item-toggle").click();
  await expect(item.getByTestId("todo-item-toggle")).not.toBeChecked();
  await expect(item.getByTestId("todo-item-title")).toHaveCSS("text-decoration-line", "none");
});

test("TC-047：前端切換後重新整理狀態保持", async ({ page }) => {
  await apiCreate("TC-047：待切換");
  await page.goto("/");

  const item = page.getByTestId("todo-item").filter({ hasText: "TC-047：待切換" });
  await item.getByTestId("todo-item-toggle").click();
  await expect(item.getByTestId("todo-item-toggle")).toBeChecked();

  await page.reload();
  const itemAfter = page.getByTestId("todo-item").filter({ hasText: "TC-047：待切換" });
  await expect(itemAfter.getByTestId("todo-item-toggle")).toBeChecked();
});
