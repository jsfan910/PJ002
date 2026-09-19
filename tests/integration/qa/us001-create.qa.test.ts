/**
 * tests/integration/qa/us001-create.qa.test.ts
 *
 * T-0021（qa-at）：US-001 新增待辦，integration 層級、P0、自動化＝是的 TC。
 * 對 `$BASE_URL`（預設本機 docker compose）發真實 HTTP，帶 Basic Auth。
 * TC-ID 對照 `docs/specs/20_測試案例.md` §1.1。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { deleteTodo, http, waitForHealth } from "./lib/http-client.ts";
import type { Todo } from "./lib/http-client.ts";

test.before(async () => {
  await waitForHealth();
});

test("TC-004：POST /api/v1/todos 建立成功回 201，四欄且 GET 清單可見", async () => {
  const response = await http.post<Todo>("/api/v1/todos", { title: "TC-004：寫系統設計書" });

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = response.json();
  assert.deepEqual(Object.keys(body).sort(), ["createdAt", "id", "isCompleted", "title"]);
  assert.match(body.id, /^[0-9a-f-]{36}$/i);
  assert.equal(body.isCompleted, false);

  const list = await http.get<Todo[]>("/api/v1/todos");
  assert.equal(list.status, 200);
  assert.ok(list.json().some((todo) => todo.id === body.id));

  await deleteTodo(body.id);
});

test("TC-005：POST 空白標題三種情境皆回 400 統一錯誤物件，且未建立資料", async () => {
  const before = await http.get<Todo[]>("/api/v1/todos");
  const beforeCount = before.json().length;

  for (const title of ["", "   ", undefined]) {
    const payload = title === undefined ? {} : { title };
    const response = await http.post("/api/v1/todos", payload);
    assert.equal(response.status, 400, `title=${JSON.stringify(title)}`);
    const body = response.json() as { code: string; details?: unknown; requestId: string };
    assert.equal(body.code, "E_VALIDATION");
    if (body.details !== undefined && title) {
      assert.equal(JSON.stringify(body.details).includes(title), false, "details 不回射輸入原文");
    }
    assert.equal(typeof body.requestId, "string");
  }

  const after = await http.get<Todo[]>("/api/v1/todos");
  assert.equal(after.json().length, beforeCount, "三次皆未建立資料");
});

test("TC-006：POST 201 字元標題回 400；200 字元邊界回 201", async () => {
  const tooLong = await http.post("/api/v1/todos", { title: "a".repeat(201) });
  assert.equal(tooLong.status, 400);
  assert.equal((tooLong.json() as { code: string }).code, "E_VALIDATION");

  const boundary = await http.post<Todo>("/api/v1/todos", { title: "b".repeat(200) });
  assert.equal(boundary.status, 201);
  await deleteTodo(boundary.json().id);
});

test("TC-007：POST 夾帶不可寫欄位一律忽略（BR-012、BR-003、BR-006）", async () => {
  const response = await http.post<Todo>("/api/v1/todos", {
    title: "TC-007：夾帶欄位",
    id: "00000000-0000-0000-0000-000000000000",
    createdAt: "2000-01-01T00:00:00Z",
    isCompleted: true,
    ownerId: "someone-else",
    completedAt: "2000-01-01T00:00:00Z"
  });

  assert.equal(response.status, 201);
  const body = response.json();
  assert.notEqual(body.id, "00000000-0000-0000-0000-000000000000");
  assert.notEqual(body.createdAt, "2000-01-01T00:00:00Z");
  assert.equal(body.isCompleted, false);
  assert.equal("completedAt" in body, false);
  assert.equal("ownerId" in body, false);
  assert.equal("updatedAt" in body, false);

  await deleteTodo(body.id);
});

