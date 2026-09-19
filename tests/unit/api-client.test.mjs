/**
 * tests/unit/api-client.test.mjs
 *
 * 驗證 public/assets/api-client.js（FE-02）：
 *   - 五個端點的請求形狀（method／path／query／headers／body）與 04_API規格.yaml 一致。
 *   - 統一錯誤物件（Error schema）被解析為具名例外 `ApiError`。
 *   - 網路失敗（`fetch` 直接拋出例外）被轉為具名例外 `NetworkError`。
 *   - `DELETE` 的 204 回應不嘗試解析 JSON、回傳 `undefined`。
 *
 * 以全域 `fetch` 的 stub 注入，不需要真實網路或伺服器（WBS §1.4 驗收方式草案）。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiError,
  NetworkError,
  listTodos,
  createTodo,
  getTodoById,
  updateTodo,
  deleteTodo
} from "../../public/assets/api-client.js";

const originalFetch = globalThis.fetch;

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return calls;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function noBodyResponse(status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error("must not call json() on a no-body response");
    }
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("listTodos() 不帶 status 時，GET /api/v1/todos 不帶查詢字串", async () => {
  const calls = stubFetch(() =>
    jsonResponse(200, [
      { id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", title: "買牛奶", isCompleted: false, createdAt: "2026-09-19T05:29:41.482Z" }
    ])
  );

  const result = await listTodos();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/v1/todos");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.body, undefined);
  assert.equal(calls[0].init.headers, undefined);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
});

test("listTodos(status) 帶 status 時，組出 /api/v1/todos?status=active", async () => {
  const calls = stubFetch(() => jsonResponse(200, []));

  await listTodos("active");

  assert.equal(calls[0].url, "/api/v1/todos?status=active");
  assert.equal(calls[0].init.method, "GET");
});

test("createTodo(title) 送出 POST，帶 Content-Type 與 JSON body", async () => {
  const calls = stubFetch(() =>
    jsonResponse(201, {
      id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      title: "寫系統設計書",
      isCompleted: false,
      createdAt: "2026-09-19T05:29:41.482Z"
    })
  );

  const result = await createTodo("寫系統設計書");

  assert.equal(calls[0].url, "/api/v1/todos");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, { "Content-Type": "application/json" });
  assert.equal(calls[0].init.body, JSON.stringify({ title: "寫系統設計書" }));
  assert.equal(result.isCompleted, false);
});

test("getTodoById(id) 送出 GET /api/v1/todos/{id}", async () => {
  const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  const calls = stubFetch(() =>
    jsonResponse(200, { id, title: "寫系統設計書", isCompleted: false, createdAt: "2026-09-19T05:29:41.482Z" })
  );

  const result = await getTodoById(id);

  assert.equal(calls[0].url, `/api/v1/todos/${id}`);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(result.id, id);
});

test("updateTodo(id, patch) 送出 PATCH，body 為傳入的 patch 物件", async () => {
  const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  const calls = stubFetch(() =>
    jsonResponse(200, { id, title: "寫系統設計書", isCompleted: true, createdAt: "2026-09-19T05:29:41.482Z" })
  );

  const result = await updateTodo(id, { isCompleted: true });

  assert.equal(calls[0].url, `/api/v1/todos/${id}`);
  assert.equal(calls[0].init.method, "PATCH");
  assert.deepEqual(calls[0].init.headers, { "Content-Type": "application/json" });
  assert.equal(calls[0].init.body, JSON.stringify({ isCompleted: true }));
  assert.equal(result.isCompleted, true);
});

test("deleteTodo(id) 送出 DELETE，204 回應不解析 JSON 且回傳 undefined", async () => {
  const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  const calls = stubFetch(() => noBodyResponse(204));

  const result = await deleteTodo(id);

  assert.equal(calls[0].url, `/api/v1/todos/${id}`);
  assert.equal(calls[0].init.method, "DELETE");
  assert.equal(result, undefined);
});

test("非 2xx 回應且帶統一錯誤物件時，拋出具名例外 ApiError 並保留 code/message/details/requestId", async () => {
  stubFetch(() =>
    jsonResponse(400, {
      code: "E_VALIDATION",
      message: "title must not be empty after trimming",
      details: { field: "title", rule: "minLength" },
      requestId: "req-7f3a2c"
    })
  );

  await assert.rejects(
    () => createTodo("   "),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.name, "ApiError");
      assert.equal(error.status, 400);
      assert.equal(error.code, "E_VALIDATION");
      assert.equal(error.message, "title must not be empty after trimming");
      assert.deepEqual(error.details, { field: "title", rule: "minLength" });
      assert.equal(error.requestId, "req-7f3a2c");
      return true;
    }
  );
});

test("401 未認證回應同樣被解析為 ApiError（E_UNAUTHORIZED）", async () => {
  stubFetch(() =>
    jsonResponse(401, {
      code: "E_UNAUTHORIZED",
      message: "Authentication required",
      requestId: "req-0c9e33"
    })
  );

  await assert.rejects(
    () => listTodos(),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      assert.equal(error.code, "E_UNAUTHORIZED");
      return true;
    }
  );
});

test("404 查無資料回應被解析為 ApiError（E_NOT_FOUND）", async () => {
  const id = "00000000-0000-4000-8000-000000000000";
  stubFetch(() =>
    jsonResponse(404, {
      code: "E_NOT_FOUND",
      message: "Todo not found",
      requestId: "req-9df402"
    })
  );

  await assert.rejects(
    () => getTodoById(id),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 404);
      assert.equal(error.code, "E_NOT_FOUND");
      return true;
    }
  );
});

test("5xx 伺服器錯誤回應被解析為 ApiError（E_INTERNAL），不含堆疊或內部細節", async () => {
  stubFetch(() =>
    jsonResponse(500, {
      code: "E_INTERNAL",
      message: "Internal Server Error",
      requestId: "req-b71c5a"
    })
  );

  await assert.rejects(
    () => updateTodo("3f2504e0-4f89-41d3-9a0c-0305e82c3301", { isCompleted: true }),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 500);
      assert.equal(error.code, "E_INTERNAL");
      assert.equal(error.message, "Internal Server Error");
      return true;
    }
  );
});

test("網路失敗（fetch 直接拋出例外，例如斷線）被轉為具名例外 NetworkError", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  await assert.rejects(
    () => listTodos(),
    (error) => {
      assert.ok(error instanceof NetworkError);
      assert.equal(error.name, "NetworkError");
      assert.ok(error.cause instanceof TypeError);
      return true;
    }
  );
});
