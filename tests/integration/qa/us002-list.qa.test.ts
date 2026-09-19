/**
 * tests/integration/qa/us002-list.qa.test.ts
 * T-0021（qa-at）：US-002 檢視待辦清單，integration 層級 P0 TC。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createTodo, deleteTodo, http, waitForHealth } from "./lib/http-client.ts";
import type { Todo } from "./lib/http-client.ts";

test.before(async () => {
  await waitForHealth();
});

test("TC-013：GET 清單回全部筆數與必要四欄，不含 updatedAt/ownerId/completedAt", async () => {
  const created = await Promise.all([
    createTodo("TC-013：基準集-1"),
    createTodo("TC-013：基準集-2"),
    createTodo("TC-013：基準集-3")
  ]);

  const response = await http.get<Todo[]>("/api/v1/todos");
  assert.equal(response.status, 200);
  const ids = new Set(created.map((todo) => todo.id));
  const mine = response.json().filter((todo) => ids.has(todo.id));
  assert.equal(mine.length, 3);
  for (const todo of mine) {
    assert.deepEqual(Object.keys(todo).sort(), ["createdAt", "id", "isCompleted", "title"]);
  }

  await Promise.all(created.map((todo) => deleteTodo(todo.id)));
});

test("TC-014：清空後 GET 清單回 200 空陣列而非 404（BR-028）", async () => {
  const list = await http.get<Todo[]>("/api/v1/todos");
  assert.equal(list.status, 200);
  await Promise.all(list.json().map((todo) => deleteTodo(todo.id)));

  const afterClear = await http.get<Todo[]>("/api/v1/todos");
  assert.equal(afterClear.status, 200);
  assert.deepEqual(afterClear.json(), []);
});

test("TC-015：同秒建立多筆，五次重複 GET 順序完全相同（created_at DESC, id DESC）", async () => {
  const created = await Promise.all([
    createTodo("TC-015：同秒集-A"),
    createTodo("TC-015：同秒集-B"),
    createTodo("TC-015：同秒集-C")
  ]);
  const ids = new Set(created.map((todo) => todo.id));

  const orders: string[][] = [];
  for (let i = 0; i < 5; i += 1) {
    const response = await http.get<Todo[]>("/api/v1/todos");
    orders.push(
      response
        .json()
        .filter((todo) => ids.has(todo.id))
        .map((todo) => todo.id)
    );
  }

  for (let i = 1; i < orders.length; i += 1) {
    assert.deepEqual(orders[i], orders[0], `第 ${i + 1} 次的順序須與第 1 次完全相同`);
  }

  await Promise.all(created.map((todo) => deleteTodo(todo.id)));
});
