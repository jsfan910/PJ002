/**
 * tests/unit/todo-store.test.mjs
 *
 * 驗證 public/assets/todo-store.js（FE-03）：
 *   - BR-011：任一異動成功後，以目前 filter 重新向 api-client 取清單並整份替換 state.todos。
 *   - BR-010：filter 預設 `all`，設定 filter 會重新取清單。
 *   - O-002：`setCompleted` 直接送出呼叫端給的目標值，不做反轉／toggle。
 *   - 標題驗證（trim 後長度 1~200）在呼叫 API 前先做，失敗時不送出任何請求。
 *   - 每個 action 的成功／失敗（ApiError／NetworkError）分支皆有覆蓋，且不觸碰真實網路
 *     （以假的 api-client 物件注入 `createTodoStore`）。
 *
 * ---------------------------------------------------------------------------
 * TC-ID 對應表（T-0042 補標，關閉測試總結 r3 的殘留風險 R-6）
 * ---------------------------------------------------------------------------
 * 標註規則與「完全／部分覆蓋」的判準同 `tests/unit/todo-service.test.ts` 檔頭。
 * **本次只加名稱前綴與註解，未改動任何 `assert`。**
 *
 * | TC | 對應測試 | 覆蓋程度 |
 * |----|----------|----------|
 * | TC-048 | `[TC-048] FILTERS 常數固定三值，預設為 all（BR-010）` ／ `[TC-048] setFilter()：非法值不呼叫 API…` | **前端等效覆蓋**。TC-048 的前置條件寫的是 `todo-service` ＋ 測試替身，而後端 `listTodos` 是純轉發、不驗 status（落點在 `src/schemas/todo-schema.ts` 的 querystring enum，屬整合層）。本檔這兩條測的是**同一條業務規則 BR-010 在前端 store 的落實**：三值固定、預設 `all`、非法值連 API 都不打。標在此處是為了讓 TC-048 的「步驟 1 預設值」與「步驟 3 拒絕非法值」在 unit 層至少有一處真的被斷言，**不是**宣稱後端 service 層已驗 status |
 *
 * 另：`TC-009`／`TC-067`（e2e 層、D-017）已由本檔下方兩條時序測試以
 * `D-017／TC-xxx：` 前綴標註，為 T-0038 所加，不在 T-0042 的 11 條 unit
 * 層清單內，此處僅說明命名為何有兩種前綴形式。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createTodoStore, validateTitle, toDisplayError, FILTERS } from "../../public/assets/todo-store.js";
import { ApiError, NetworkError } from "../../public/assets/api-client.js";

const SAMPLE_TODO = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  title: "寫系統設計書",
  isCompleted: false,
  createdAt: "2026-09-19T05:29:41.482Z"
};

/** 建立一個可記錄呼叫、回應可自訂的假 api-client。 */
function createMockApi(overrides = {}) {
  const calls = { listTodos: [], createTodo: [], updateTodo: [], deleteTodo: [] };
  const api = {
    async listTodos(status) {
      calls.listTodos.push(status);
      if (overrides.listTodos) {
        return overrides.listTodos(status);
      }
      return [SAMPLE_TODO];
    },
    async createTodo(title) {
      calls.createTodo.push(title);
      if (overrides.createTodo) {
        return overrides.createTodo(title);
      }
      return { ...SAMPLE_TODO, title };
    },
    async updateTodo(id, patch) {
      calls.updateTodo.push({ id, patch });
      if (overrides.updateTodo) {
        return overrides.updateTodo(id, patch);
      }
      return { ...SAMPLE_TODO, ...patch };
    },
    async deleteTodo(id) {
      calls.deleteTodo.push(id);
      if (overrides.deleteTodo) {
        return overrides.deleteTodo(id);
      }
      return undefined;
    }
  };
  return { api, calls };
}

function collectStates(store) {
  const states = [];
  store.subscribe((state) => states.push(state));
  return states;
}

// ---------------------------------------------------------------------------
// validateTitle / toDisplayError（純函式）
// ---------------------------------------------------------------------------

test("validateTitle：trim 後為空回失敗", () => {
  assert.equal(validateTitle("   ").ok, false);
  assert.equal(validateTitle("").ok, false);
});

test("validateTitle：trim 後長度剛好 200 為合法上限", () => {
  const result = validateTitle(`  ${"a".repeat(200)}  `);
  assert.equal(result.ok, true);
  assert.equal(result.value.length, 200);
});

test("validateTitle：trim 後長度 201 回失敗（不得走到 500，前端先擋）", () => {
  const result = validateTitle("a".repeat(201));
  assert.equal(result.ok, false);
});

test("toDisplayError：ApiError 依 code 轉為可讀訊息並保留 kind=api", () => {
  const err = new ApiError({ code: "E_NOT_FOUND", message: "Todo not found", requestId: "req-1" }, 404);
  const display = toDisplayError(err);
  assert.equal(display.kind, "api");
  assert.equal(display.code, "E_NOT_FOUND");
  assert.ok(display.message.length > 0);
});

test("toDisplayError：NetworkError 轉為 kind=network 且訊息與 API 錯誤不同", () => {
  const display = toDisplayError(new NetworkError(new TypeError("fetch failed")));
  assert.equal(display.kind, "network");
  assert.ok(display.message.includes("網路") || display.message.includes("連線"));
});

// ---------------------------------------------------------------------------
// load()
// ---------------------------------------------------------------------------

test("load()：成功時整份替換 todos，loading 先 true 後 false，error 清空", async () => {
  const { api, calls } = createMockApi({ listTodos: async () => [SAMPLE_TODO] });
  const store = createTodoStore(api);
  const states = collectStates(store);

  const result = await store.actions.load();

  assert.equal(result.ok, true);
  assert.deepEqual(store.getState().todos, [SAMPLE_TODO]);
  assert.equal(store.getState().loading, false);
  assert.equal(store.getState().error, null);
  assert.equal(calls.listTodos.length, 1);
  assert.equal(calls.listTodos[0], "all");
  assert.ok(states.some((s) => s.loading === true));
});

test("load()：ApiError 失敗時設定 error，todos 維持原狀，不丟例外", async () => {
  const { api } = createMockApi({
    listTodos: async () => {
      throw new ApiError({ code: "E_INTERNAL", message: "Internal Server Error" }, 500);
    }
  });
  const store = createTodoStore(api);

  const result = await store.actions.load();

  assert.equal(result.ok, false);
  assert.equal(store.getState().loading, false);
  assert.equal(store.getState().error.kind, "api");
  assert.equal(store.getState().error.code, "E_INTERNAL");
  assert.deepEqual(store.getState().todos, []);
});

test("load()：網路失敗（NetworkError）時設定 kind=network 的 error", async () => {
  const { api } = createMockApi({
    listTodos: async () => {
      throw new NetworkError(new TypeError("fetch failed"));
    }
  });
  const store = createTodoStore(api);

  await store.actions.load();

  assert.equal(store.getState().error.kind, "network");
});

test("load()：先發後到時，只有最新一次的回應會寫入 state（S-5，CR-E001 請求序列化）", async () => {
  // 模擬快速連續切換篩選：第一次呼叫的回應被延遲（之後才手動 resolve），
  // 第二次呼叫立即完成並先抵達。第一次的（較舊）回應終於到達時不得覆蓋
  // 已經是最新一次（第二次）的結果。
  const SECOND_TODO = { ...SAMPLE_TODO, id: "id-2", title: "第二次篩選的結果" };
  let resolveFirst;
  const firstResponse = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  let callCount = 0;
  const { api, calls } = createMockApi({
    listTodos: async () => {
      callCount += 1;
      if (callCount === 1) {
        return firstResponse.then(() => [SAMPLE_TODO]);
      }
      return [SECOND_TODO];
    }
  });
  const store = createTodoStore(api);

  const firstLoad = store.actions.load("active"); // 先發出（會延遲回應）
  const secondLoad = store.actions.load("completed"); // 後發出，但立即 resolve

  const secondResult = await secondLoad;
  assert.equal(secondResult.ok, true);
  assert.deepEqual(store.getState().todos, [SECOND_TODO]);
  assert.equal(store.getState().filter, "completed");

  // 讓第一次（較舊）的回應終於到達（後到）。
  resolveFirst();
  const firstResult = await firstLoad;

  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.stale, true);
  // 畫面資料仍是最新一次（第二次）篩選的結果，未被先發後到的舊回應覆蓋。
  assert.deepEqual(store.getState().todos, [SECOND_TODO]);
  assert.equal(store.getState().filter, "completed");
  assert.deepEqual(calls.listTodos, ["active", "completed"]);
});

// ---------------------------------------------------------------------------
// D-017：跨動作競態（初始 load() 因真實網路延遲仍在飛行中時，不得覆蓋稍後才
// 設定的 error）。修正前，`add()/updateTitle()/setCompleted()/remove()`（含
// `add()/updateTitle()` 的同步驗證失敗分支）完全不佔用 `load()` 的請求序號保護，
// 因此一個較舊、仍在飛行中的 `load()`（例如頁面啟動時的初始載入）一旦稍後才
// resolve，其成功分支會無條件把 `state.error` 蓋回 `null`，將使用者剛看到的
// 錯誤訊息（`error-message`）又變回 hidden——這正是 TC-067／TC-009 在 staging
// 真實網路延遲下間歇性失敗、但本機 docker compose（延遲趨近於零）幾乎不會踩到
// 這個時間窗的根因。
// ---------------------------------------------------------------------------

test("D-017／TC-009：初始 load() 因延遲仍在飛行中時，同步驗證失敗的 error 不會被稍後才 resolve 的 load() 蓋回 null", async () => {
  let resolveList;
  const pendingList = new Promise((resolve) => {
    resolveList = resolve;
  });
  const { api } = createMockApi({
    // 模擬頁面啟動時初始 load() 對真實後端的 GET /api/v1/todos 有網路延遲，
    // 尚未 resolve。
    listTodos: async () => pendingList.then(() => [SAMPLE_TODO])
  });
  const store = createTodoStore(api);

  const initialLoad = store.actions.load(); // 模擬 todo-view.js 啟動時呼叫的初始 load()

  // 初始 load() 仍在飛行中時，使用者送出空白標題（TC-009 步驟 1~2）。
  const addResult = await store.actions.add("   ");
  assert.equal(addResult.ok, false);
  assert.equal(store.getState().error.kind, "validation");

  // 較舊的初始 load() 這時才姍姍來遲地 resolve（成功）。
  resolveList();
  const initialResult = await initialLoad;

  assert.equal(initialResult.stale, true);
  // 修正前：initialLoad 的成功分支會無條件 setState({ error: null })，
  // 把剛顯示的驗證錯誤蓋掉，畫面上的 error-message 又會變回 hidden（D-017）。
  assert.equal(
    store.getState().error && store.getState().error.kind,
    "validation",
    "初始 load() 較晚 resolve 不得清掉稍後才設定的驗證錯誤（D-017）"
  );
});

test("D-017／TC-067：初始 load() 因延遲仍在飛行中時，新增失敗（後端 500）的 error 不會被稍後才 resolve 的 load() 蓋回 null", async () => {
  let resolveList;
  const pendingList = new Promise((resolve) => {
    resolveList = resolve;
  });
  const { api } = createMockApi({
    // 模擬頁面啟動時初始 load() 對真實後端有網路延遲，尚未 resolve。
    listTodos: async () => pendingList.then(() => [SAMPLE_TODO]),
    // 模擬 TC-067 以路由攔截讓 POST /api/v1/todos 回 500，且此回應比初始
    // load() 先抵達（攔截回應是立即的，初始 load() 打的是真實延遲的網路）。
    createTodo: async () => {
      throw new ApiError({ code: "E_INTERNAL", message: "Internal Server Error" }, 500);
    }
  });
  const store = createTodoStore(api);

  const initialLoad = store.actions.load(); // 模擬 todo-view.js 啟動時呼叫的初始 load()

  // 初始 load() 仍在飛行中時，使用者嘗試新增一筆，後端回 500（TC-067 步驟 1~2）。
  const addResult = await store.actions.add("買牛奶");
  assert.equal(addResult.ok, false);
  assert.equal(store.getState().error.code, "E_INTERNAL");

  // 較舊的初始 load() 這時才 resolve（成功）。
  resolveList();
  const initialResult = await initialLoad;

  assert.equal(initialResult.stale, true);
  // 修正前：initialLoad 的成功分支會無條件 setState({ error: null })，
  // 把剛顯示的「伺服器發生錯誤」訊息蓋掉，畫面上的 error-message 又會變回
  // hidden，斷言逾時（D-017 於 staging 間歇性失敗的實際現象）。
  assert.equal(
    store.getState().error && store.getState().error.code,
    "E_INTERNAL",
    "初始 load() 較晚 resolve 不得清掉稍後才設定的新增失敗錯誤（D-017）"
  );
});

// ---------------------------------------------------------------------------
// setFilter()
// ---------------------------------------------------------------------------

test("setFilter()：合法值會以新 filter 重新取清單", async () => {
  const { api, calls } = createMockApi();
  const store = createTodoStore(api);

  await store.actions.setFilter("active");

  assert.equal(store.getState().filter, "active");
  assert.deepEqual(calls.listTodos, ["active"]);
});

test("[TC-048] setFilter()：非法值不呼叫 API，回 ok:false", async () => {
  const { api, calls } = createMockApi();
  const store = createTodoStore(api);

  const result = await store.actions.setFilter("bogus");

  assert.equal(result.ok, false);
  assert.equal(calls.listTodos.length, 0);
  assert.equal(store.getState().filter, "all");
});

test("[TC-048] FILTERS 常數固定三值，預設為 all（BR-010）", () => {
  assert.deepEqual(FILTERS, ["all", "active", "completed"]);
  assert.equal(createTodoStore(createMockApi().api).getState().filter, "all");
});

// ---------------------------------------------------------------------------
// add()
// ---------------------------------------------------------------------------

test("add()：空白標題不呼叫 API，設定 validation 錯誤", async () => {
  const { api, calls } = createMockApi();
  const store = createTodoStore(api);

  const result = await store.actions.add("   ");

  assert.equal(result.ok, false);
  assert.equal(calls.createTodo.length, 0);
  assert.equal(store.getState().error.kind, "validation");
});

test("add()：成功時先 trim 再呼叫 createTodo，成功後整份重新取清單（BR-011）", async () => {
  const { api, calls } = createMockApi({
    listTodos: async () => [SAMPLE_TODO, { ...SAMPLE_TODO, id: "id-2", title: "買牛奶" }]
  });
  const store = createTodoStore(api);

  const result = await store.actions.add("  買牛奶  ");

  assert.equal(result.ok, true);
  assert.equal(calls.createTodo[0], "買牛奶");
  assert.equal(calls.listTodos.length, 1);
  assert.equal(store.getState().todos.length, 2);
  assert.equal(store.getState().error, null);
});

test("add()：createTodo 回 ApiError（例如 400）時設定 error，不觸發重新載入清單", async () => {
  const { api, calls } = createMockApi({
    createTodo: async () => {
      throw new ApiError({ code: "E_VALIDATION", message: "title must not be empty after trimming" }, 400);
    }
  });
  const store = createTodoStore(api);

  const result = await store.actions.add("有效標題");

  assert.equal(result.ok, false);
  assert.equal(store.getState().error.code, "E_VALIDATION");
  assert.equal(calls.listTodos.length, 0);
});

// ---------------------------------------------------------------------------
// updateTitle()
// ---------------------------------------------------------------------------

test("updateTitle()：全空白標題不呼叫 API（AC-003-2，原標題保持不變）", async () => {
  const { api, calls } = createMockApi();
  const store = createTodoStore(api);

  const result = await store.actions.updateTitle(SAMPLE_TODO.id, "   ");

  assert.equal(result.ok, false);
  assert.equal(calls.updateTodo.length, 0);
  assert.equal(store.getState().error.kind, "validation");
});

test("updateTitle()：成功時呼叫 updateTodo({title}) 並重新取清單", async () => {
  const { api, calls } = createMockApi();
  const store = createTodoStore(api);

  const result = await store.actions.updateTitle(SAMPLE_TODO.id, "  新標題  ");

  assert.equal(result.ok, true);
  assert.deepEqual(calls.updateTodo[0], { id: SAMPLE_TODO.id, patch: { title: "新標題" } });
  assert.equal(calls.listTodos.length, 1);
});

test("updateTitle()：查無資料（404）時設定 E_NOT_FOUND 錯誤", async () => {
  const { api } = createMockApi({
    updateTodo: async () => {
      throw new ApiError({ code: "E_NOT_FOUND", message: "Todo not found" }, 404);
    }
  });
  const store = createTodoStore(api);

  const result = await store.actions.updateTitle(SAMPLE_TODO.id, "新標題");

  assert.equal(result.ok, false);
  assert.equal(store.getState().error.code, "E_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// setCompleted()（O-002：設定目標狀態，非 toggle）
// ---------------------------------------------------------------------------

test("setCompleted()：直接送出呼叫端給的目標值 true，不做反轉", async () => {
  const { api, calls } = createMockApi();
  const store = createTodoStore(api);

  await store.actions.setCompleted(SAMPLE_TODO.id, true);

  assert.deepEqual(calls.updateTodo[0], { id: SAMPLE_TODO.id, patch: { isCompleted: true } });
});

test("setCompleted()：目標值 false 時同樣直接送出（重送同值應為冪等，此處驗證呼叫參數不變）", async () => {
  const { api, calls } = createMockApi();
  const store = createTodoStore(api);

  await store.actions.setCompleted(SAMPLE_TODO.id, false);
  await store.actions.setCompleted(SAMPLE_TODO.id, false);

  assert.deepEqual(calls.updateTodo[0].patch, { isCompleted: false });
  assert.deepEqual(calls.updateTodo[1].patch, { isCompleted: false });
});

test("setCompleted()：伺服器失敗時設定 error，並回 ok:false", async () => {
  const { api } = createMockApi({
    updateTodo: async () => {
      throw new ApiError({ code: "E_INTERNAL", message: "Internal Server Error" }, 500);
    }
  });
  const store = createTodoStore(api);

  const result = await store.actions.setCompleted(SAMPLE_TODO.id, true);

  assert.equal(result.ok, false);
  assert.equal(store.getState().error.code, "E_INTERNAL");
});

// ---------------------------------------------------------------------------
// remove()（Q-003：硬刪除；二次確認由 view 負責，store 只執行刪除）
// ---------------------------------------------------------------------------

test("remove()：成功時呼叫 deleteTodo 並重新取清單", async () => {
  const { api, calls } = createMockApi({ listTodos: async () => [] });
  const store = createTodoStore(api);

  const result = await store.actions.remove(SAMPLE_TODO.id);

  assert.equal(result.ok, true);
  assert.deepEqual(calls.deleteTodo, [SAMPLE_TODO.id]);
  assert.deepEqual(store.getState().todos, []);
});

test("remove()：刪除不存在的資料（404）時設定 error，不得丟出未捕捉例外", async () => {
  const { api } = createMockApi({
    deleteTodo: async () => {
      throw new ApiError({ code: "E_NOT_FOUND", message: "Todo not found" }, 404);
    }
  });
  const store = createTodoStore(api);

  const result = await store.actions.remove(SAMPLE_TODO.id);

  assert.equal(result.ok, false);
  assert.equal(store.getState().error.code, "E_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// retry() 與 subscribe/unsubscribe
// ---------------------------------------------------------------------------

test("retry()：以目前 filter 重新載入（供錯誤畫面的重試使用）", async () => {
  const { api, calls } = createMockApi();
  const store = createTodoStore(api);

  await store.actions.setFilter("completed");
  await store.actions.retry();

  assert.deepEqual(calls.listTodos, ["completed", "completed"]);
});

test("subscribe()：回傳的 unsubscribe 呼叫後不再收到通知", async () => {
  const { api } = createMockApi();
  const store = createTodoStore(api);
  let notifyCount = 0;
  const unsubscribe = store.subscribe(() => {
    notifyCount += 1;
  });

  await store.actions.load();
  const countAfterFirstLoad = notifyCount;
  unsubscribe();
  await store.actions.load();

  assert.equal(notifyCount, countAfterFirstLoad);
});
