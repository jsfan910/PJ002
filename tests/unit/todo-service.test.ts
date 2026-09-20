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
 *
 * ---------------------------------------------------------------------------
 * TC-ID 對應表（T-0042 補標，關閉測試總結 r3 的殘留風險 R-6）
 * ---------------------------------------------------------------------------
 * 標註規則：測試名稱前綴 `[TC-xxx]`，可用 `grep -rn "TC-xxx" tests/unit` 逐條追溯。
 * **本次只加名稱前綴與註解，未改動任何 `assert`**；因此下表老實區分「完全
 * 覆蓋」與「部分覆蓋」，並寫明沒被斷言到的是哪一句，不以「有標到就算追溯」
 * 充數。未覆蓋的子斷言列為 P1 補測建議（見 T-0042 交接檔「下一步建議」）。
 *
 * | TC | 對應測試 | 覆蓋程度 |
 * |----|----------|----------|
 * | TC-001 | `[TC-001] createTodo：空字串…` ／ `…全空白字串…` | **部分**：預期結果的「三次皆拋 `ValidationError`」已覆蓋空字串與全空白兩組，第三組輸入 `"\t\n "` 未單獨測（`validateAndTrimTitle` 對這三者走同一條 `trim()` 路徑）；「repository 的寫入方法**零次**被呼叫」**未斷言**（測試只驗例外的 code／statusCode，沒有檢查 `db.calls.length === 0`） |
 * | TC-002 | `[TC-002] createTodo：一般標題會先 trim…` ／ `…剛好 200 字元…` ／ `…201 字元…` ／ `…trim 後才是 201 字元…` | **完全**：步驟 1（200 字元成功）、步驟 2（201 字元 `ValidationError`）皆直接斷言；步驟 3（前後空白 ＋ 200 字元）由「先 trim 再交給 repository」＋「trim 後才是 201 字元仍回 400」兩條夾擊，證明驗證確實發生在 trim 之後 |
 * | TC-003 | 見 `tests/unit/todo-repository.test.ts` 的 `[TC-003]` 兩條 | 本層不重複斷言：`id`／`createdAt`／`isCompleted` 全由 SQL `RETURNING` 決定，service 只是把 repository 的回傳原樣往上送 |
 * | TC-012 | 見 `tests/unit/todo-repository.test.ts` 的 `[TC-012]` | 本層 `listTodos` 為純轉發，排序寫在 SQL |
 * | TC-019 | `[TC-019] updateTodo：title 為全空白…` | **部分**：兩組輸入中的 `"   "` 已覆蓋，`""` **未單獨測**（`updateTodo` 只以 `input.title === undefined` 判斷欄位是否提供，`""` 與 `"   "` 同樣會走到 `validateAndTrimTitle` 並拋 `E_VALIDATION`，見 `src/services/todo-service.ts:92-99`）；「repository 的更新方法**零次**被呼叫」同樣**未斷言** |
 * | TC-020 | `[TC-020] updateTodo：只給 title…` | **完全**：`db.calls[0].values` 為 `[id, "new title", null]`，第三個參數 `null` 即「`is_completed` 不在異動欄位集合內」（`buildUpdateCommand` 以 `COALESCE` 保留原值）；`created_at`／`id`／`owner_id` 本來就不在 UPDATE 的 SET 子句（由 `[TC-020]` 的 repository 測試釘住） |
 * | TC-030 | `[TC-030] deleteTodo：刪除成功…` ＋ repository 的 `[TC-030]` | **完全**（跨兩檔）：service 呼叫的是 `delete` 而非帶旗標的更新，SQL 字面由 repository 測試逐字比對；「service 介面不存在還原方法」由本檔的 import 清單即可核對（只匯入五個函式，無 restore／undelete） |
 * | TC-038 | `[TC-038] updateTodo：只給 isCompleted=true…` ／ `…重送 isCompleted=true 仍是同一個結果…` | **完全**：重送同值兩次 `deepEqual(first, second)`，且兩次傳給 repository 的第三個參數都是 `true`（不翻轉）；「service 不提供 toggle 語意的方法」同樣由 import 清單核對 |
 * | TC-039 | `[TC-039] updateTodo：只給 isCompleted=true…` ＋ repository 的 `[TC-039]` | **部分**：「異動欄位只含 `is_completed`」已由 `values` 的 `[id, null, true]` 斷言；「回傳物件的 `title`／`createdAt` 不變、不存在 `completedAt`」在本層只斷言了 `result.isCompleted === true`，完整的四欄位 `deepEqual`（可證明沒有 `completedAt`）在 repository 測試 |
 * | TC-048 | `[TC-048] listTodos：把 status 原樣轉給 repository…` ＋ repository 的 `[TC-048]` ＋ `tests/unit/todo-store.test.mjs` 的 `[TC-048]` | **部分**：步驟 2（`all`／`active`／`completed` 三值皆被接受並轉為查詢條件）由 repository 的 `buildListCommand` 迴圈完全覆蓋；**步驟 1（不帶 `status` 等同 `all`）與步驟 3（`foo`／`ALL`／`""` 拋 `ValidationError`）在後端不落在 `todo-service`**——`listTodos(db, status)` 是純轉發、不做任何驗證，實際落點是 `src/schemas/todo-schema.ts` 的 `StatusFilterQuerystringSchema`（`enum: ["all","active","completed"]` ＋ `default: "all"`），由路由層 schema 擋下並回 400，屬整合層 TC 的覆蓋範圍；前端等效行為由 store 的 `[TC-048]` 兩條斷言 |
 * | TC-059 | 見 `tests/unit/todo-repository.test.ts` 的 `[TC-059]` | 轉換函式在 repository |
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

test("[TC-048] listTodos：把 status 原樣轉給 repository，回傳 camelCase 列", async () => {
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

test("[TC-002] createTodo：一般標題會先 trim 再交給 repository", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  await createTodo(db, "  buy milk  ");

  assert.equal(db.calls[0]?.values[0], "buy milk", "應傳入 trim 後的標題");
});

test("[TC-001] createTodo：空字串回 E_VALIDATION/400（BR-001）", () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  return assertRejectsAppError(createTodo(db, ""), "E_VALIDATION", 400);
});

test("[TC-001] createTodo：全空白字串回 E_VALIDATION/400（schema 的 minLength 擋不掉，業務層再驗一次）", () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  return assertRejectsAppError(createTodo(db, "   "), "E_VALIDATION", 400);
});

test("createTodo：剛好 1 字元（trim 後）視為合法", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  await createTodo(db, " a ");

  assert.equal(db.calls[0]?.values[0], "a");
});

test("[TC-002] createTodo：剛好 200 字元（trim 後）視為合法", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  const title200 = "a".repeat(200);

  await createTodo(db, title200);

  assert.equal(db.calls[0]?.values[0], title200);
  assert.equal((db.calls[0]?.values[0] as string).length, 200);
});

test("[TC-002] createTodo：201 字元（無前後空白）回 E_VALIDATION/400 而非 500", () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  return assertRejectsAppError(createTodo(db, "a".repeat(201)), "E_VALIDATION", 400);
});

test("[TC-002] createTodo：trim 後才是 201 字元（原始字串因前後空白更長）回 400 而非 500（R-07 的核心情境）", () => {
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

test("[TC-020] updateTodo：只給 title 時 trim 後再驗證長度，isCompleted 傳 undefined 給 repository", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  await updateTodo(db, SAMPLE_RAW_ROW.id, { title: "  new title  " });

  assert.deepEqual(db.calls[0]?.values, [SAMPLE_RAW_ROW.id, "new title", null]);
});

test("[TC-019] updateTodo：title 為全空白回 E_VALIDATION/400", () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));
  return assertRejectsAppError(updateTodo(db, SAMPLE_RAW_ROW.id, { title: "   " }), "E_VALIDATION", 400);
});

test("[TC-038][TC-039] updateTodo：只給 isCompleted=true（設定目標狀態，非 toggle）", async () => {
  const db = createMockDb(() => ({ rows: [{ ...SAMPLE_RAW_ROW, is_completed: true }] }));

  const result = await updateTodo(db, SAMPLE_RAW_ROW.id, { isCompleted: true });

  assert.deepEqual(db.calls[0]?.values, [SAMPLE_RAW_ROW.id, null, true]);
  assert.equal(result.isCompleted, true);
});

test("[TC-038] updateTodo：對已完成的待辦重送 isCompleted=true 仍是同一個結果（冪等，O-002）", async () => {
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

test("[TC-030] deleteTodo：刪除成功不丟例外（由路由層回 204）", async () => {
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
