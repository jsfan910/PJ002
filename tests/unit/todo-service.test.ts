/**
 * tests/unit/todo-service.test.ts
 *
 * `todo-service.ts`（BE-05，**業務規則的唯一落點**）的純邏輯單元測試。
 * 以最小相容的 mock `Queryable`（只實作 `.query`，結構同
 * `tests/unit/todo-repository.test.ts`）取代真實 `pg.Pool`，不需要
 * Postgres——這正是 T-0013 交接檔強調的「以最小介面注入」帶來的好處。
 *
 * 匯入路徑指向 `../../dist/...`（已編譯輸出），而非 `src/`：
 * `src/services/todo-service.ts` 內部以 `.js` 匯入規格參照
 * `../repositories/todo-repository.js`／`../schemas/error-schema.js`
 * （NodeNext 規則要求），Node 的原生 TypeScript 型別剝除不會把這個匯入
 * 規格回頭解析成同名 `.ts` 檔（與 `tests/unit/error-handler.test.ts`
 * 檔頭說明的限制相同）。因此本測試依賴「先 `npm run build` 再跑測試」
 * 的順序，與整合測試一致。
 *
 * 覆蓋重點（WBS §1.6 acceptance：「單元測試覆蓋每個錯誤碼與邊界」）：
 * - BR-001／BR-002：`trim()` 早於長度檢查；空字串／全空白／剛好
 *   1～200 字元／201 字元（含「trim 後才 201」的邊界，R-07）皆有斷言。
 * - BR-009：找不到資源一律 `AppError("E_NOT_FOUND", ...)`，涵蓋
 *   `getTodoById`／`updateTodo`／`deleteTodo` 三個入口。
 * - BR-012：PATCH 至少一個可更新欄位，否則 400；夾帶欄位的忽略行為由
 *   schema 層負責，本層只驗證「至少一個」與「有提供的欄位各自合法」。
 * - O-002：`updateTodo` 對 `isCompleted` 是「設定目標狀態」，不做任何
 *   toggle 邏輯（本層没有基於現值計算下一個值，直接把目標值轉給
 *   repository，重送同一個值必然是同一個結果，冪等由此保證）。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../dist/schemas/error-schema.js";
import {
  createTodo,
  deleteTodo,
  getTodoById,
  listTodos,
  updateTodo
} from "../../dist/services/todo-service.js";

interface RecordedCall {
  text: string;
  values: unknown[];
}

interface QueryResultLike<T> {
  rows: T[];
  rowCount: number | null;
}

interface MockDb {
  calls: RecordedCall[];
  query<T>(text: string, values?: unknown[]): Promise<QueryResultLike<T>>;
}

/** 建立不連真實資料庫的 mock：記錄每次呼叫，回應由測試自訂。 */
function createMockDb(respond: (call: RecordedCall) => { rows: unknown[]; rowCount?: number | null }): MockDb {
  const calls: RecordedCall[] = [];
  return {
    calls,
    async query<T>(text: string, values: unknown[] = []): Promise<QueryResultLike<T>> {
      const call = { text, values };
      calls.push(call);
      const { rows, rowCount } = respond(call);
      return { rows: rows as T[], rowCount: rowCount ?? rows.length };
    }
  };
}

const SAMPLE_RAW_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "buy milk",
  is_completed: false,
  created_at: new Date("2026-09-19T00:00:00.000Z")
};

async function assertRejectsAppError(promise: Promise<unknown>, code: string, statusCode: number): Promise<void> {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof AppError, "應丟出 AppError");
    const appErr = err as InstanceType<typeof AppError>;
    assert.equal(appErr.code, code);
    assert.equal(appErr.statusCode, statusCode);
    return true;
  });
}

// ---------------------------------------------------------------------------
// listTodos：純轉發，狀態原樣交給 repository（後端篩選，O-003）
// ---------------------------------------------------------------------------

test("listTodos：把 status 原樣轉給 repository，回傳 camelCase 列", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  const result = await listTodos(db, "active");

  assert.equal(db.calls.length, 1);
  assert.deepEqual(db.calls[0]?.values, ["active"]);
  assert.deepEqual(result, [
    {
      id: SAMPLE_RAW_ROW.id,
      title: SAMPLE_RAW_ROW.title,
      isCompleted: false,
      createdAt: SAMPLE_RAW_ROW.created_at
    }
  ]);
});

// ---------------------------------------------------------------------------
// createTodo：BR-001／BR-002，trim 早於長度檢查（R-07）
// ---------------------------------------------------------------------------

test("createTodo：一般標題會先 trim 再交給 repository", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  await createTodo(db, "  buy milk  ");

  assert.equal(db.calls[0]?.values[0], "buy milk", "應傳入 trim 後的標題");
});

test("createTodo：空字串回 E_VALIDATION/400（BR-001）", () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  return assertRejectsAppError(createTodo(db, ""), "E_VALIDATION", 400);
});

test("createTodo：全空白字串回 E_VALIDATION/400（schema 的 minLength 擋不掉，業務層再驗一次）", () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  return assertRejectsAppError(createTodo(db, "   "), "E_VALIDATION", 400);
});

test("createTodo：剛好 1 字元（trim 後）視為合法", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  await createTodo(db, " a ");

  assert.equal(db.calls[0]?.values[0], "a");
});

test("createTodo：剛好 200 字元（trim 後）視為合法", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  const title200 = "a".repeat(200);

  await createTodo(db, title200);

  assert.equal(db.calls[0]?.values[0], title200);
  assert.equal((db.calls[0]?.values[0] as string).length, 200);
});

test("createTodo：201 字元（無前後空白）回 E_VALIDATION/400 而非 500", () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  return assertRejectsAppError(createTodo(db, "a".repeat(201)), "E_VALIDATION", 400);
});

test("createTodo：trim 後才是 201 字元（原始字串因前後空白更長）回 400 而非 500（R-07 的核心情境）", () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  const rawTitle = "   " + "a".repeat(201) + "   "; // trim 後長度 201
  return assertRejectsAppError(createTodo(db, rawTitle), "E_VALIDATION", 400);
});

// ---------------------------------------------------------------------------
// getTodoById：BR-009
// ---------------------------------------------------------------------------

test("getTodoById：查得到即回傳 camelCase 物件", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  const result = await getTodoById(db, SAMPLE_RAW_ROW.id);

  assert.equal(result.id, SAMPLE_RAW_ROW.id);
});

test("getTodoById：查無資料回 E_NOT_FOUND/404（BR-009）", () => {
  const db = createMockDb(() => ({ rows: [] }));
  return assertRejectsAppError(getTodoById(db, "11111111-1111-4111-8111-111111111111"), "E_NOT_FOUND", 404);
});

// ---------------------------------------------------------------------------
// updateTodo：BR-012（至少一個欄位）、O-002（設定目標狀態，非 toggle）、BR-009
// ---------------------------------------------------------------------------

test("updateTodo：空 body（無 title 也無 isCompleted）回 E_VALIDATION/400（BR-012）", () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  return assertRejectsAppError(updateTodo(db, SAMPLE_RAW_ROW.id, {}), "E_VALIDATION", 400);
});

test("updateTodo：只給 title 時 trim 後再驗證長度，isCompleted 傳 undefined 給 repository", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  await updateTodo(db, SAMPLE_RAW_ROW.id, { title: "  new title  " });

  assert.deepEqual(db.calls[0]?.values, [SAMPLE_RAW_ROW.id, "new title", null]);
});

test("updateTodo：title 為全空白回 E_VALIDATION/400", () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  return assertRejectsAppError(updateTodo(db, SAMPLE_RAW_ROW.id, { title: "   " }), "E_VALIDATION", 400);
});

test("updateTodo：只給 isCompleted=true（設定目標狀態，非 toggle）", async () => {
  const db = createMockDb(() => ({ rows: [{ ...SAMPLE_RAW_ROW, is_completed: true }] }));

  const result = await updateTodo(db, SAMPLE_RAW_ROW.id, { isCompleted: true });

  assert.deepEqual(db.calls[0]?.values, [SAMPLE_RAW_ROW.id, null, true]);
  assert.equal(result.isCompleted, true);
});

test("updateTodo：對已完成的待辦重送 isCompleted=true 仍是同一個結果（冪等，O-002）", async () => {
  const db = createMockDb(() => ({ rows: [{ ...SAMPLE_RAW_ROW, is_completed: true }] }));

  const first = await updateTodo(db, SAMPLE_RAW_ROW.id, { isCompleted: true });
  const second = await updateTodo(db, SAMPLE_RAW_ROW.id, { isCompleted: true });

  assert.deepEqual(first, second);
  assert.equal(db.calls[0]?.values[2], true);
  assert.equal(db.calls[1]?.values[2], true);
});

test("updateTodo：查無資料回 E_NOT_FOUND/404（BR-009，且不得因此建立資料）", () => {
  const db = createMockDb(() => ({ rows: [] }));
  return assertRejectsAppError(
    updateTodo(db, "11111111-1111-4111-8111-111111111111", { isCompleted: true }),
    "E_NOT_FOUND",
    404
  );
});

// ---------------------------------------------------------------------------
// deleteTodo：BR-008／BR-009
// ---------------------------------------------------------------------------

test("deleteTodo：刪除成功不丟例外（由路由層回 204）", async () => {
  const db = createMockDb(() => ({ rows: [], rowCount: 1 }));

  await assert.doesNotReject(deleteTodo(db, SAMPLE_RAW_ROW.id));
});

test("deleteTodo：查無資料回 E_NOT_FOUND/404（BR-009，不得回 5xx）", () => {
  const db = createMockDb(() => ({ rows: [], rowCount: 0 }));
  return assertRejectsAppError(
    deleteTodo(db, "11111111-1111-4111-8111-111111111111"),
    "E_NOT_FOUND",
    404
  );
});
