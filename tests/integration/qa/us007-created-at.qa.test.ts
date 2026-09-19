/**
 * tests/integration/qa/us007-created-at.qa.test.ts
 * T-0021（qa-at）：US-007 顯示建立時間，integration 層級 P0 TC。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createTodo, deleteTodo, http, waitForHealth } from "./lib/http-client.ts";
import type { Todo } from "./lib/http-client.ts";

const ISO_8601_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

test.before(async () => {
  await waitForHealth();
});

test("TC-060：建立時間為建立當下（誤差 < 60 秒）", async () => {
  const t0 = Date.now();
  const created = await createTodo("TC-060：時間誤差");
  const t1 = new Date(created.createdAt).getTime();
  assert.ok(Math.abs(t1 - t0) < 60_000, `誤差 ${Math.abs(t1 - t0)}ms 應 < 60000ms`);
  await deleteTodo(created.id);
});

test("TC-061：編輯與切換後 createdAt 位元不變（字串完全相等）", async () => {
  const created = await createTodo("TC-061：原標題");
  await http.patch(`/api/v1/todos/${created.id}`, { title: "TC-061：改標題" });
  await http.patch(`/api/v1/todos/${created.id}`, { isCompleted: true });
  await http.patch(`/api/v1/todos/${created.id}`, { isCompleted: false });
  const fetched = await http.get<Todo>(`/api/v1/todos/${created.id}`);
  assert.equal(fetched.json().createdAt, created.createdAt);
  await deleteTodo(created.id);
});

test("TC-062：GET 清單每筆 createdAt 皆符合 ISO 8601 且含時區，可被 Date 解析", async () => {
  const created = await Promise.all([
    createTodo("TC-062：格式-1"),
    createTodo("TC-062：格式-2"),
    createTodo("TC-062：格式-3")
  ]);
  const ids = new Set(created.map((todo) => todo.id));

  const response = await http.get<Todo[]>("/api/v1/todos");
  const mine = response.json().filter((todo) => ids.has(todo.id));
  assert.equal(mine.length, 3);
  for (const todo of mine) {
    assert.match(todo.createdAt, ISO_8601_WITH_TZ);
    assert.equal(Number.isNaN(new Date(todo.createdAt).getTime()), false);
  }

  await Promise.all(created.map((todo) => deleteTodo(todo.id)));
});
