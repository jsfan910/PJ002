/**
 * tests/e2e/us006-filter.e2e.test.ts
 * T-0021（qa-at）：US-006 依狀態篩選，e2e 層級 P0 TC。
 */
import { expect, test } from "@playwright/test";

import { apiClearAll, apiCreate, apiSetCompleted } from "./lib/api-helper.js";

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-053：前端三種篩選切換顯示正確子集", async ({ page }) => {
  const a1 = await apiCreate("TC-053：未完成-1");
  const a2 = await apiCreate("TC-053：未完成-2");
  const c1 = await apiCreate("TC-053：已完成-1");
  const c2 = await apiCreate("TC-053：已完成-2");
  await apiSetCompleted(c1.id, true);
  await apiSetCompleted(c2.id, true);

  await page.goto("/");
  await expect(page.getByTestId("todo-item")).toHaveCount(4);

  await page.getByTestId("filter-option-active").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(2);
  await expect(page.getByTestId("todo-item").filter({ hasText: a1.title })).toBeVisible();
  await expect(page.getByTestId("todo-item").filter({ hasText: a2.title })).toBeVisible();

  await page.getByTestId("filter-option-completed").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(2);
  await expect(page.getByTestId("todo-item").filter({ hasText: c1.title })).toBeVisible();

  await page.getByTestId("filter-option-all").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(4);
});

test("TC-054：未完成篩選下切換為已完成則該筆自畫面移除（BR-011）", async ({ page }) => {
  await apiCreate("TC-054：A");
  await apiCreate("TC-054：B");
  await page.goto("/");
  await page.getByTestId("filter-option-active").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(2);

  await page.getByTestId("todo-item").filter({ hasText: "TC-054：A" }).getByTestId("todo-item-toggle").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(1);
  await expect(page.getByTestId("todo-item").filter({ hasText: "TC-054：A" })).toHaveCount(0);

  await page.getByTestId("filter-option-completed").click();
  await expect(page.getByTestId("todo-item").filter({ hasText: "TC-054：A" })).toBeVisible();
});

test("TC-055：全部篩選下切換則就地更新視覺呈現（BR-011）", async ({ page }) => {
  await apiCreate("TC-055：A");
  await apiCreate("TC-055：B");
  await apiCreate("TC-055：C");
  await apiCreate("TC-055：D");
  await page.goto("/");
  await expect(page.getByTestId("todo-item")).toHaveCount(4);

  const target = page.getByTestId("todo-item").filter({ hasText: "TC-055：A" });
  await target.getByTestId("todo-item-toggle").click();

  await expect(page.getByTestId("todo-item")).toHaveCount(4, { timeout: 5000 });
  await expect(target.getByTestId("todo-item-title")).toHaveCSS("text-decoration-line", "line-through");
});

test("TC-056：篩選結果為零筆時顯示可讀提示（BR-028）", async ({ page }) => {
  await apiCreate("TC-056：未完成-1");
  await apiCreate("TC-056：未完成-2");
  await page.goto("/");

  await page.getByTestId("filter-option-completed").click();
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByTestId("error-message")).toBeHidden();
});

test("TC-057：生效中的篩選有明確視覺標示", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("filter-option-all")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("filter-option-active")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("filter-option-active").click();
  await expect(page.getByTestId("filter-option-active")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("filter-option-all")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("filter-option-completed").click();
  await expect(page.getByTestId("filter-option-completed")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("filter-option-active")).toHaveAttribute("aria-pressed", "false");
});

test("TC-058：篩選不寫入網址且不跨重新整理保留（BR-010）", async ({ page }) => {
  await apiCreate("TC-058：A");
  await apiCreate("TC-058：B");
  await page.goto("/");

  await page.getByTestId("filter-option-completed").click();
  expect(page.url()).not.toMatch(/[?#].*(filter|status|completed)/i);

  await page.reload();
  await expect(page.getByTestId("filter-option-all")).toHaveAttribute("aria-pressed", "true");
});
