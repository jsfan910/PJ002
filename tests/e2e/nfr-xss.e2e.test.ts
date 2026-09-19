/**
 * tests/e2e/nfr-xss.e2e.test.ts
 * T-0021（qa-at）：TC-088（NFR-002⑤、BR-013）——使用者輸入顯示時逸出，
 * 腳本不被執行。
 */
import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { apiClearAll, apiCreate } from "./lib/api-helper.js";

const exec = promisify(execFile);

test.beforeEach(async () => {
  await apiClearAll();
});

test("TC-088：<script>alert(1)</script> 標題原樣顯示為文字，零彈窗", async ({ page }) => {
  await apiCreate("<script>alert(1)</script>");

  let dialogCount = 0;
  page.on("dialog", (dialog) => {
    dialogCount += 1;
    void dialog.dismiss();
  });

  await page.goto("/");
  const titleEl = page.getByTestId("todo-item-title");
  await expect(titleEl).toHaveText("<script>alert(1)</script>");

  const innerHtml = await page.getByTestId("todo-list").innerHTML();
  expect(innerHtml.includes("<script>alert(1)</script>")).toBe(false);
  expect(dialogCount).toBe(0);

  const { stdout } = await exec("git", ["grep", "-rn", "innerHTML", "public/"]).catch(
    (error: { stdout?: string }) => ({ stdout: error.stdout ?? "" })
  );
  expect(stdout.trim(), `public/ 內不得使用 innerHTML 拼接：${stdout}`).toBe("");
});
