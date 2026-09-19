/**
 * tests/integration/qa/us003-edit.qa.test.ts
 * T-0021（qa-at）：US-003 編輯待辦，integration 層級 P0 TC。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createTodo, deleteTodo, http, NON_EXISTENT_ID, waitForHealth } from "./lib/http-client.ts";
import type { Todo } from "./lib/http-client.ts";

test.before(async () => {
  await waitForHealth();
});

test("TC-021：PATCH 修改標題成功回 200，GET 亦反映新標題", async () => {
  const created = await createTodo("TC-021：舊標題");
  const patched = await http.patch<Todo>(`/api/v1/todos/${created.id}`, { title: "TC-021：新標題" });
  assert.equal(patched.status, 200);
  assert.equal(patched.json().title, "TC-021：新標題");

  const fetched = await http.get<Todo>(`/api/v1/todos/${created.id}`);
  assert.equal(fetched.json().title, "TC-021：新標題");

  await deleteTodo(created.id);
});

test("TC-022：PATCH 空白標題回 400，原資料不變", async () => {
  const created = await createTodo("TC-022：舊標題");
  const response = await http.patch(`/api/v1/todos/${created.id}`, { title: "   " });
  assert.equal(response.status, 400);
  assert.equal((response.json() as { code: string }).code, "E_VALIDATION");

  const fetched = await http.get<Todo>(`/api/v1/todos/${created.id}`);
  assert.equal(fetched.json().title, "TC-022：舊標題");

  await deleteTodo(created.id);
});

test("TC-023：PATCH 後 createdAt 與 isCompleted 不變（BR-003）", async () => {
  const created = await createTodo("TC-023：原標題");
  await http.patch(`/api/v1/todos/${created.id}`, { isCompleted: true });
  const before = await http.get<Todo>(`/api/v1/todos/${created.id}`);

  await http.patch(`/api/v1/todos/${created.id}`, { title: "TC-023：改過的標題" });
  const after = await http.get<Todo>(`/api/v1/todos/${created.id}`);

  assert.equal(after.json().createdAt, before.json().createdAt);
  assert.equal(after.json().isCompleted, true);

  await deleteTodo(created.id);
});

test("TC-024：PATCH 不存在的識別碼回 404（BR-009），且不建立新資料", async () => {
  const before = await http.get<Todo[]>("/api/v1/todos");
  const beforeCount = before.json().length;

  const response = await http.patch(`/api/v1/todos/${NON_EXISTENT_ID}`, { title: "x" });
  assert.equal(response.status, 404);
  assert.equal((response.json() as { code: string }).code, "E_NOT_FOUND");

  const after = await http.get<Todo[]>("/api/v1/todos");
  assert.equal(after.json().length, beforeCount);
});

test("TC-025：PATCH 超長標題與空 body 皆回 400", async () => {
  const created = await createTodo("TC-025：原標題");

  const tooLong = await http.patch(`/api/v1/todos/${created.id}`, { title: "a".repeat(201) });
  assert.equal(tooLong.status, 400);

  const emptyBody = await http.patch(`/api/v1/todos/${created.id}`, {});
  assert.equal(emptyBody.status, 400);

  const fetched = await http.get<Todo>(`/api/v1/todos/${created.id}`);
  assert.equal(fetched.json().title, "TC-025：原標題");

  await deleteTodo(created.id);
});
