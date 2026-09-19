/**
 * tests/e2e/us008-spa.e2e.test.ts
 * T-0021（qa-at）：US-008 單頁前端操作，e2e 層級 P0 TC。
 */
import { expect, test } from "@playwright/test";

import { apiClearAll, apiCreate } from "./lib/api-helper.js";

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-065：首頁載入後新增／清單／篩選控制項同頁呈現", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("add-todo-input")).toBeVisible();
  await expect(page.getByTestId("add-todo-submit")).toBeVisible();
  await expect(page.getByTestId("todo-list")).toBeVisible();
  await expect(page.getByTestId("filter-option-all")).toBeVisible();
  await expect(page.getByTestId("filter-option-active")).toBeVisible();
  await expect(page.getByTestId("filter-option-completed")).toBeVisible();
});

test("TC-066：完整操作序列全程滑鼠可完成且無整頁跳轉", async ({ page }) => {
  let navigations = 0;
  page.on("framenavigated", () => {
    navigations += 1;
  });

  await page.goto("/");
  navigations = 0; // 只計本次操作序列期間的導覽次數

  await page.getByTestId("add-todo-input").fill("序列-A");
  await page.getByTestId("add-todo-submit").click();
  // 等第一筆落地再送第二筆，理由見 us002-list.e2e.test.ts TC-018 檔內註解。
  await expect(page.getByTestId("todo-item").filter({ hasText: "序列-A" })).toBeVisible();
  await page.getByTestId("add-todo-input").fill("序列-B");
  await page.getByTestId("add-todo-submit").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(2);

  const itemA = page.getByTestId("todo-item").filter({ hasText: "序列-A" });
  await itemA.getByTestId("todo-item-edit").click();
  await page.getByTestId("todo-item-edit-input").fill("序列-A-已編輯");
  await page.getByTestId("todo-item-edit-save").click();
  await expect(page.getByTestId("todo-item").filter({ hasText: "序列-A-已編輯" })).toBeVisible();

  await page.getByTestId("todo-item").filter({ hasText: "序列-A-已編輯" }).getByTestId("todo-item-toggle").click();

  await page.getByTestId("filter-option-active").click();
  await page.getByTestId("filter-option-completed").click();
  await page.getByTestId("filter-option-all").click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("todo-item").filter({ hasText: "序列-B" }).getByTestId("todo-item-delete").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(1);

  expect(navigations, "整段操作序列期間不應有任何整頁導覽").toBe(0);
});

test("TC-067：後端失敗時顯示可讀錯誤且畫面不凍結（BR-029）", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("empty-state")).toBeVisible();

  let intercept = true;
  await page.route("**/api/v1/todos*", async (route) => {
    if (route.request().method() === "POST" && intercept) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "E_INTERNAL", message: "Internal Server Error", requestId: "req-test" })
      });
      return;
    }
    await route.continue();
  });

  await page.getByTestId("add-todo-input").fill("失敗後重試");
  await page.getByTestId("add-todo-submit").click();

  await expect(page.getByTestId("error-message")).toBeVisible();
  await expect(page.getByTestId("loading-indicator")).toBeHidden();
  await expect(page.locator("body")).toBeVisible();

  intercept = false;
  await page.getByTestId("add-todo-input").fill("失敗後重試");
  await page.getByTestId("add-todo-submit").click();
  await expect(page.getByTestId("todo-item").filter({ hasText: "失敗後重試" })).toBeVisible();
});

test("TC-068：等待後端回應期間有載入中指示（BR-030）", async ({ page }) => {
  await apiCreate("TC-068：既有資料");

  await page.route("**/api/v1/todos*", async (route) => {
    if (route.request().method() === "GET") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await route.continue();
  });

  await page.goto("/");
  await expect(page.getByTestId("loading-indicator")).toBeVisible();
  await expect(page.getByTestId("loading-indicator")).toBeHidden({ timeout: 10000 });
});

test("TC-069：兩種視窗尺寸下版面無重疊且無橫向捲動（BR-031，NFR-004 逐瀏覽器版本見 TC-091）", async ({ page }) => {
  await apiCreate("TC-069：一般標題");
  await apiCreate("TC-069：另一筆較長標題較長標題較長標題較長標題較長標題較長標題");

  for (const size of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(size);
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow, `視窗 ${size.width}x${size.height} 不應出現橫向捲動`).toBe(false);
  }
});
