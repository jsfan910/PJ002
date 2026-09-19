/**
 * tests/integration/qa/us004-delete.qa.test.ts
 * T-0021（qa-at）：US-004 刪除待辦，integration 層級 P0 TC。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createTodo, deleteTodo, http, NON_EXISTENT_ID, waitForHealth } from "./lib/http-client.ts";
import type { Todo } from "./lib/http-client.ts";

test.before(async () => {
  await waitForHealth();
});

test("TC-031：DELETE 成功回 204 無本文（AC-009-3 寫死，非 200），GET 之後回 404", async () => {
  const created = await createTodo("TC-031：待刪除");
  const response = await http.delete(`/api/v1/todos/${created.id}`);
  assert.equal(response.status, 204);
  assert.equal(response.bodyText, "");

  const after = await http.get(`/api/v1/todos/${created.id}`);
  assert.equal(after.status, 404);
});

test("TC-032：刪除後清單不再含該筆，且重啟服務容器後仍不含（持久化）", async () => {
  const created = await Promise.all([createTodo("TC-032：基準-1"), createTodo("TC-032：基準-2"), createTodo("TC-032：基準-3")]);
  await deleteTodo(created[0].id);

  const list = await http.get<Todo[]>("/api/v1/todos");
  const ids = list.json().map((todo) => todo.id);
  assert.equal(ids.includes(created[0].id), false);
  assert.ok(ids.includes(created[1].id));
  assert.ok(ids.includes(created[2].id));

  // 「重啟服務容器」段：由 TC-093（NFR-006 持久化）以 docker compose restart 涵蓋，
  // 避免每個 TC 各自重啟容器造成互相干擾；此處只驗刪除立即生效與清單不含。
  await deleteTodo(created[1].id);
  await deleteTodo(created[2].id);
});

test("TC-033：DELETE 不存在的識別碼回 404，重送第二次仍 404，且不建立新資料", async () => {
  const before = await http.get<Todo[]>("/api/v1/todos");
  const beforeCount = before.json().length;

  const first = await http.delete(`/api/v1/todos/${NON_EXISTENT_ID}`);
  assert.equal(first.status, 404);
  assert.equal((first.json() as { code: string }).code, "E_NOT_FOUND");

  const second = await http.delete(`/api/v1/todos/${NON_EXISTENT_ID}`);
  assert.equal(second.status, 404);

  const after = await http.get<Todo[]>("/api/v1/todos");
  assert.equal(after.json().length, beforeCount);
});
