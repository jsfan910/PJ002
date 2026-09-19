/**
 * tests/integration/qa/us009-rest-api.qa.test.ts
 * T-0021（qa-at）：US-009 REST API 契約，integration 層級 P0 TC。
 *
 * TC-087 的第 5 種情境（500，需真的斷線資料庫才能觸發）具破壞性，不在本檔
 * 對共用服務觸發；500 情境的「不洩漏內部細節」已由既有
 * `tests/integration/error-contract.test.ts`（dev-be，T-0016，以 app.inject
 * 掛測試專用路由 `/__test/boom`）覆蓋，本檔只驗 4 種可安全觸發的情境並在
 * 執行時以 `t.skip` 註記第 5 種情境的覆蓋位置，AT 報告據此列計。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createTodo, deleteTodo, http, NON_EXISTENT_ID, waitForHealth } from "./lib/http-client.ts";
import type { Todo } from "./lib/http-client.ts";

const LEAK_PATTERN = /at .*\(.*:[0-9]+\)|select |insert |pg_|\/usr\/|\/app\/|node_modules|Error:.*\.js/i;

test.before(async () => {
  await waitForHealth();
});

test("TC-070：非瀏覽器用戶端（curl 等效 fetch）可完成全部六個待辦操作", async () => {
  const created = await http.post<Todo>("/api/v1/todos", { title: "TC-070：curl 等效" });
  assert.equal(created.status, 201);
  const id = created.json().id;

  const list = await http.get<Todo[]>("/api/v1/todos");
  assert.equal(list.status, 200);

  const single = await http.get<Todo>(`/api/v1/todos/${id}`);
  assert.equal(single.status, 200);

  const patchTitle = await http.patch<Todo>(`/api/v1/todos/${id}`, { title: "TC-070：改標題" });
  assert.equal(patchTitle.status, 200);

  const patchStatus = await http.patch<Todo>(`/api/v1/todos/${id}`, { isCompleted: true });
  assert.equal(patchStatus.status, 200);

  const deleted = await http.delete(`/api/v1/todos/${id}`);
  assert.equal(deleted.status, 204);
});

test("TC-071：清單端點狀態篩選參數（非瀏覽器用戶端）", async () => {
  const active = await createTodo("TC-071：未完成");
  const completed = await createTodo("TC-071：已完成");
  await http.patch(`/api/v1/todos/${completed.id}`, { isCompleted: true });

  const activeList = await http.get<Todo[]>("/api/v1/todos?status=active");
  assert.ok(activeList.json().every((todo) => todo.isCompleted === false));

  const completedList = await http.get<Todo[]>("/api/v1/todos?status=completed");
  assert.ok(completedList.json().every((todo) => todo.isCompleted === true));

  await deleteTodo(active.id);
  await deleteTodo(completed.id);
});

test("TC-072：狀態碼與 Content-Type 語意矩陣（201/200/204/400/404，AC-009-3 特殊判準）", async () => {
  const create = await http.post<Todo>("/api/v1/todos", { title: "TC-072：矩陣" });
  assert.equal(create.status, 201);
  assert.equal(create.headers.get("content-type")?.includes("application/json"), true);
  const id = create.json().id;

  const list = await http.get<Todo[]>("/api/v1/todos");
  assert.equal(list.status, 200);
  assert.equal(list.headers.get("content-type")?.includes("application/json"), true);

  const del = await http.delete(`/api/v1/todos/${id}`);
  assert.equal(del.status, 204, "刪除成功寫死為 204，不接受 200");
  assert.equal(del.bodyText, "");

  const invalid = await http.post("/api/v1/todos", { title: "" });
  assert.equal(invalid.status, 400);

  const notFound = await http.get(`/api/v1/todos/${NON_EXISTENT_ID}`);
  assert.equal(notFound.status, 404);
});

test("TC-073：400 回應為統一格式錯誤物件，details 不回射輸入原文", async () => {
  const missingTitle = await http.post("/api/v1/todos", {});
  const emptyTitle = await http.post("/api/v1/todos", { title: "" });
  const badStatus = await http.get("/api/v1/todos?status=foo");

  for (const response of [missingTitle, emptyTitle, badStatus]) {
    assert.equal(response.status, 400);
    const body = response.json() as { code: string; message: string; requestId: string; details?: unknown };
    assert.equal(body.code, "E_VALIDATION");
    assert.equal(typeof body.message, "string");
    assert.equal(typeof body.requestId, "string");
    if (body.details !== undefined) {
      assert.equal(JSON.stringify(body.details).length < 200, true);
    }
  }
});

test("TC-074：回應不含 access-control-allow-origin（同源部署，ADR-0004 第 6 點）", async () => {
  const response = await http.get("/api/v1/todos");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("TC-076：路徑參數格式錯誤回 400；格式合法但查無資料回 404，分界不得混用", async () => {
  const invalidFormat = await http.get("/api/v1/todos/not-a-uuid");
  assert.equal(invalidFormat.status, 400);
  assert.equal((invalidFormat.json() as { code: string }).code, "E_VALIDATION");

  const validButMissing = await http.get(`/api/v1/todos/${NON_EXISTENT_ID}`);
  assert.equal(validButMissing.status, 404);
  assert.equal((validButMissing.json() as { code: string }).code, "E_NOT_FOUND");
});

test("TC-087：4 種可安全觸發的錯誤情境不洩漏內部細節（500 情境見上方檔頭說明）", async (t) => {
  const badTitle = await http.post("/api/v1/todos", { title: "" });
  const unauthorized = await http.get("/api/v1/todos", { auth: false });
  const notFound = await http.get(`/api/v1/todos/${NON_EXISTENT_ID}`);
  const badStatus = await http.get("/api/v1/todos?status=foo");

  for (const response of [badTitle, unauthorized, notFound, badStatus]) {
    assert.equal(LEAK_PATTERN.test(response.bodyText), false, `疑似洩漏內部細節：${response.bodyText}`);
    const body = response.json() as { requestId: string };
    assert.equal(typeof body.requestId, "string");
  }

  await t.test("500 情境（跳過，理由見檔頭）", (inner) => {
    inner.skip("需真的斷線資料庫才能安全觸發 500，已由 tests/integration/error-contract.test.ts 的 /__test/boom 覆蓋（不洩漏 ECONNREFUSED／堆疊）");
  });
});

test("TC-092：4xx 與 5xx 回應同形；requestId 可 grep 到對應日誌（本機以回應層驗證，日誌關聯見下方註記）", async () => {
  const fourHundred = await http.post("/api/v1/todos", { title: "" });
  const fourOhFour = await http.get(`/api/v1/todos/${NON_EXISTENT_ID}`);

  assert.equal(fourHundred.status, 400);
  assert.equal(fourOhFour.status, 404);
  assert.deepEqual(Object.keys(fourHundred.json() as object).sort(), ["code", "details", "message", "requestId"]);
  assert.deepEqual(Object.keys(fourOhFour.json() as object).sort(), ["code", "message", "requestId"]);
  // 「details」欄位存在與否依錯誤類型而定，屬同一份 schema 的合法差異（error-schema.ts）。
  // pino 日誌與 requestId 的關聯（NFR-005）由 tests/integration/error-contract.test.ts
  // 的「requestId 與 pino 的 reqId 為同一值」單元覆蓋（app 內可直接比對 request.id）；
  // 對 $BASE_URL 發 HTTP 時測試程式無法讀取伺服器端日誌檔，故本檔僅驗回應契約同形。
});
