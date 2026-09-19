/**
 * tests/e2e/nfr-compat.e2e.test.ts
 * T-0021（qa-at）：TC-091（NFR-004、BR-031）——3 瀏覽器 × 2 尺寸相容性檢查。
 *
 * 本檔本身對每個 Playwright project（見 playwright.config.ts 的 6 個
 * project：chromium/msedge/firefox × 1280x800/390x844）各跑一次，執行
 * US-001~US-007 的精簡操作流程，檢查無橫向捲動、無元素重疊，並記錄
 * 瀏覽器版本號。若某瀏覽器本機未安裝（`npx playwright install` 未涵蓋），
 * 該 project 的測試會回報失敗於「啟動瀏覽器」而非「操作流程」，AT 報告
 * 依 07 §7 R-5 只需記錄「執行當下可取得的版本」，未取得的瀏覽器記
 * 「阻擋（環境未就緒）」，不需人工補測前一版。
 */
import { expect, test } from "@playwright/test";

import { apiClearAll, apiCreate } from "./lib/api-helper.js";

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-091：US-001~US-007 操作流程無重疊、無橫向捲動，並記錄瀏覽器版本", async ({ page, browserName, browser }, testInfo) => {
  await apiCreate("TC-091：基準-1");
  await apiCreate("TC-091：基準-2");

  await page.goto("/");

  // US-001：新增
  await page.getByTestId("add-todo-input").fill("TC-091：新增");
  await page.getByTestId("add-todo-submit").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(3);

  // US-005：切換完成
  const target = page.getByTestId("todo-item").filter({ hasText: "TC-091：新增" });
  await target.getByTestId("todo-item-toggle").click();
  await expect(target.getByTestId("todo-item-toggle")).toBeChecked();

  // US-006：篩選
  await page.getByTestId("filter-option-completed").click();
  await expect(page.getByTestId("todo-item")).toHaveCount(1);
  await page.getByTestId("filter-option-all").click();

  // US-003：編輯
  await target.getByTestId("todo-item-edit").click();
  await page.getByTestId("todo-item-edit-input").fill("TC-091：已編輯");
  await page.getByTestId("todo-item-edit-save").click();
  await expect(page.getByTestId("todo-item").filter({ hasText: "TC-091：已編輯" })).toBeVisible();

  // 無橫向捲動（BR-031）
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll, `${browserName}／viewport ${testInfo.project.name} 不應有橫向捲動`).toBe(false);

  // 無元素重疊：檢查清單控制項彼此的 bounding box 不互相重疊
  const boxes = await page.evaluate(() => {
    const selectors = [
      '[data-testid="add-todo-form"]',
      '[data-testid="filter-controls"]',
      '[data-testid="todo-list"]'
    ];
    return selectors.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { sel, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    });
  });
  const validBoxes = boxes.filter((box): box is NonNullable<typeof box> => box !== null);
  for (let i = 0; i < validBoxes.length; i += 1) {
    for (let j = i + 1; j < validBoxes.length; j += 1) {
      const a = validBoxes[i];
      const b = validBoxes[j];
      // noUncheckedIndexedAccess（tsconfig.json）下索引存取回傳 T | undefined；
      // i／j 都在陣列長度內，此處僅為型別收斂。
      if (!a || !b) continue;
      const overlapsVertically = a.top < b.bottom && b.top < a.bottom;
      // 三大區塊本就垂直排列（新增表單／篩選/清單），允許緊鄰但不應大幅重疊
      const overlapArea = overlapsVertically ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) : 0;
      expect(overlapArea, `${a.sel} 與 ${b.sel} 不應重疊超過 4px`).toBeLessThan(4);
    }
  }

  // 版本號記錄（07 第 7 章 R-5：僅需記錄執行當下可取得的版本）。
  testInfo.annotations.push({
    type: "browser-version",
    description: `${browserName} ${browser.version()} @ ${testInfo.project.name}`
  });
  console.log(`[TC-091][瀏覽器版本] ${browserName} ${browser.version()} @ ${testInfo.project.name}`);
});
