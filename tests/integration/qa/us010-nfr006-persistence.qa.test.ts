/**
 * tests/integration/qa/us010-nfr006-persistence.qa.test.ts
 * T-0021（qa-at）：TC-093（NFR-006）10 筆資料在「重新部署」後 100% 仍可查得。
 *
 * 本機以 `docker compose restart app`（僅重啟應用容器，資料庫容器與資料
 * volume 不受影響）近似模擬「重新部署」對資料持久性的影響——這正是
 * NFR-006 想驗證的性質（Neon／Postgres 與運算實例分離）。staging 上的
 * 「真實」重新部署仍需 T-0080 的說明留待 Gate 2 排程時人工觸發。
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

import { createTodo, deleteTodo, http, waitForHealth } from "./lib/http-client.ts";
import type { Todo } from "./lib/http-client.ts";

const exec = promisify(execFile);

test("TC-093：建立 10 筆，重啟服務容器後 10/10 一致（本機近似 NFR-006）", async (t) => {
  await waitForHealth();

  const created: Todo[] = [];
  for (let i = 0; i < 10; i += 1) {
    created.push(await createTodo(`TC-093：持久化集-${i + 1}`));
  }
  const before = created.map((todo) => ({ id: todo.id, title: todo.title }));

  try {
    await exec("docker", ["compose", "restart", "app"], { cwd: process.cwd(), timeout: 60000 });
  } catch (error) {
    t.skip(`本機無法以 docker compose restart app 重啟容器：${String(error)}`);
    await Promise.all(created.map((todo) => deleteTodo(todo.id)));
    return;
  }

  await waitForHealth(60000);

  const list = await http.get<Todo[]>("/api/v1/todos");
  const after = list
    .json()
    .filter((todo) => before.some((b) => b.id === todo.id))
    .map((todo) => ({ id: todo.id, title: todo.title }));

  const afterById = new Map(after.map((todo) => [todo.id, todo.title]));
  let matched = 0;
  for (const item of before) {
    if (afterById.get(item.id) === item.title) {
      matched += 1;
    }
  }
  assert.equal(matched, 10, `比對結果應為 10/10，實際 ${matched}/10`);

  await Promise.all(created.map((todo) => deleteTodo(todo.id)));
});
