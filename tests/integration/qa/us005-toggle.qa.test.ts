/**
 * tests/integration/qa/us005-toggle.qa.test.ts
 * T-0021（qa-at）：US-005 切換完成／未完成，integration 層級 P0 TC。
 * TC-043（持久化）在本檔以 `docker compose restart app` 驗證，需本機 docker 環境；
 * 若容器名稱偵測失敗則該案例記 skip（詳見測試內防呆與 AT 報告）。
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

import { createTodo, deleteTodo, http, waitForHealth } from "./lib/http-client.ts";
import type { Todo } from "./lib/http-client.ts";

const exec = promisify(execFile);

test.before(async () => {
  await waitForHealth();
});

test("TC-040：PATCH 設為已完成回 200", async () => {
  const created = await createTodo("TC-040：未完成");
  const response = await http.patch<Todo>(`/api/v1/todos/${created.id}`, { isCompleted: true });
  assert.equal(response.status, 200);
  assert.equal(response.json().isCompleted, true);
  await deleteTodo(created.id);
});

test("TC-041：PATCH 設回未完成回 200", async () => {
  const created = await createTodo("TC-041：待切換");
  await http.patch(`/api/v1/todos/${created.id}`, { isCompleted: true });
  const response = await http.patch<Todo>(`/api/v1/todos/${created.id}`, { isCompleted: false });
  assert.equal(response.status, 200);
  assert.equal(response.json().isCompleted, false);
  await deleteTodo(created.id);
});

test("TC-042：重送相同目標狀態結果不變（冪等，O-002）", async () => {
  const created = await createTodo("TC-042：冪等");
  const first = await http.patch<Todo>(`/api/v1/todos/${created.id}`, { isCompleted: true });
  const second = await http.patch<Todo>(`/api/v1/todos/${created.id}`, { isCompleted: true });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.json().isCompleted, true);
  assert.equal(second.json().isCompleted, true);
  const fetched = await http.get<Todo>(`/api/v1/todos/${created.id}`);
  assert.equal(fetched.json().isCompleted, true, "重送同一目標狀態不得翻轉");
  await deleteTodo(created.id);
});

test("TC-043：切換後狀態已持久化（重啟服務容器後仍為已完成）", async (t) => {
  const created = await createTodo("TC-043：持久化-切換");
  await http.patch(`/api/v1/todos/${created.id}`, { isCompleted: true });

  try {
    await exec("docker", ["compose", "restart", "app"], { cwd: process.cwd(), timeout: 60000 });
  } catch (error) {
    t.skip(`本機無法以 docker compose restart app 重啟容器（可能非本機 compose 環境）：${String(error)}`);
    await deleteTodo(created.id);
    return;
  }

  await waitForHealth(60000);
  const fetched = await http.get<Todo>(`/api/v1/todos/${created.id}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.json().isCompleted, true);

  await deleteTodo(created.id);
});

test("TC-044：切換後標題與建立時間不變", async () => {
  const created = await createTodo("TC-044：標題不變");
  const response = await http.patch<Todo>(`/api/v1/todos/${created.id}`, { isCompleted: true });
  assert.equal(response.json().title, created.title);
  assert.equal(response.json().createdAt, created.createdAt);
  await deleteTodo(created.id);
});
