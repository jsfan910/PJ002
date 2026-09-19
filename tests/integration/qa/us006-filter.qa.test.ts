/**
 * tests/integration/qa/us006-filter.qa.test.ts
 * T-0021（qa-at）：US-006 依狀態篩選，integration 層級 P0 TC。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createTodo, deleteTodo, http, waitForHealth } from "./lib/http-client.ts";
import type { Todo } from "./lib/http-client.ts";

test.before(async () => {
  await waitForHealth();
});

async function seedTwoActiveTwoCompleted(prefix: string): Promise<Todo[]> {
  const a1 = await createTodo(`${prefix}：未完成-1`);
  const a2 = await createTodo(`${prefix}：未完成-2`);
  const c1 = await createTodo(`${prefix}：已完成-1`);
  const c2 = await createTodo(`${prefix}：已完成-2`);
  await http.patch(`/api/v1/todos/${c1.id}`, { isCompleted: true });
  await http.patch(`/api/v1/todos/${c2.id}`, { isCompleted: true });
  return [a1, a2, c1, c2];
}

test("TC-049：GET ?status=active 只回未完成", async () => {
  const seeded = await seedTwoActiveTwoCompleted("TC-049");
  const response = await http.get<Todo[]>("/api/v1/todos?status=active");
  assert.equal(response.status, 200);
  const mine = response.json().filter((todo) => seeded.some((s) => s.id === todo.id));
  assert.equal(mine.length, 2);
  assert.ok(mine.every((todo) => todo.isCompleted === false));
  await Promise.all(seeded.map((todo) => deleteTodo(todo.id)));
});

test("TC-050：GET ?status=completed 只回已完成", async () => {
  const seeded = await seedTwoActiveTwoCompleted("TC-050");
  const response = await http.get<Todo[]>("/api/v1/todos?status=completed");
  assert.equal(response.status, 200);
  const mine = response.json().filter((todo) => seeded.some((s) => s.id === todo.id));
  assert.equal(mine.length, 2);
  assert.ok(mine.every((todo) => todo.isCompleted === true));
  await Promise.all(seeded.map((todo) => deleteTodo(todo.id)));
});

test("TC-051：GET ?status=all 與不帶參數結果完全相同（含順序）", async () => {
  const seeded = await seedTwoActiveTwoCompleted("TC-051");
  const withAll = await http.get<Todo[]>("/api/v1/todos?status=all");
  const withoutParam = await http.get<Todo[]>("/api/v1/todos");
  assert.equal(withAll.status, 200);
  assert.equal(withoutParam.status, 200);
  assert.deepEqual(withAll.json(), withoutParam.json());
  await Promise.all(seeded.map((todo) => deleteTodo(todo.id)));
});

test("TC-052：非法 status 值回 400，非全部亦非靜默忽略", async () => {
  const foo = await http.get("/api/v1/todos?status=foo");
  assert.equal(foo.status, 400);
  assert.equal((foo.json() as { code: string }).code, "E_VALIDATION");

  const wrongCase = await http.get("/api/v1/todos?status=Active");
  assert.equal(wrongCase.status, 400);
  assert.equal((wrongCase.json() as { code: string }).code, "E_VALIDATION");
});
