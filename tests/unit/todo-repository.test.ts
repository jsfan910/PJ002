/**
 * tests/unit/todo-repository.test.ts
 *
 * 不需要真實 Postgres 的單元測試：驗證 SQL 組裝（文字與 `$1`/`$2`/...
 * 參數順序、值）、`snake_case → camelCase` 列對應、以及 0 列／不存在
 * 時的行為，一律以最小相容的 mock `Queryable`（只實作 `.query`）取代
 * 真實連線。
 *
 * 背景：本機 Docker daemon 目前不可用（見交接檔「已知問題」），真正
 * 打 DB 的整合測試在 `tests/integration/todo-repository.test.ts`（連線
 * 失敗會自動 `skip`，不假裝通過）。本檔補上「lint/build/unit 在無 DB
 * 環境仍全綠」的覆蓋，並以程式化方式重現 05_資料庫設計.md §3 末的
 * 阻擋級 CR 判準（repository 的 SQL 字串內不得出現 `${`）。
 *
 * 匯入路徑直接用 `.ts` 副檔名（不是專案原始碼慣用的 `.js`）：本檔與
 * `test:unit` 腳本一樣直接跑 `.ts`、不依賴先 build，而 Node 的原生型別
 * 剝除在直接執行（非編譯輸出）時**不會**把 `.js` 匯入規格回頭解析成
 * 同名 `.ts` 檔（實測驗證見交接檔「驗證方式」；`src/app.ts` 用 `.js`
 * 匯入其他 `src/*.ts` 兄弟檔正是因為它只被拿來 build 成 `dist/` 後執行，
 * 從未被直接以 `node src/app.ts` 跑過）。`todo-repository.ts` 本身沒有
 * 任何本地相對匯入，用 `.ts` 明確指到真實檔案不受此限制影響。
 *
 * ---------------------------------------------------------------------------
 * TC-ID 對應表（T-0042 補標，關閉測試總結 r3 的殘留風險 R-6）
 * ---------------------------------------------------------------------------
 * 標註規則與「完全／部分覆蓋」的判準同 `tests/unit/todo-service.test.ts` 檔頭。
 * **本次只加名稱前綴與註解，未改動任何 `assert`。**
 *
 * | TC | 對應測試 | 覆蓋程度 |
 * |----|----------|----------|
 * | TC-003 | `[TC-003] createTodo：RETURNING 有列時…` ／ `[TC-003] getTodoById：有列時…` | **部分**：`getTodoById` 那條用 `assert.deepEqual` 比對**完整物件**，因此同時釘住了「`isCompleted` 存在且為布林」與「**不存在 `completedAt` 欄位**」（多一個欄位就會失敗），這是 TC-003 末句 BR-007 的直接證據；`createTodo` 那條只斷言 `todo.id`。**`id` 為 UUID 格式、`createdAt` 為建立當下時間兩項未在 unit 層斷言**——兩者都由 DDL 的 `gen_random_uuid()`／`DEFAULT now()` 產生，unit 層的 mock 回什麼就是什麼，只有整合測試（真打 DB）能驗，見 `tests/integration/todo-repository.test.ts` |
 * | TC-012 | `[TC-012][TC-048] buildListCommand：…` | **完全**：`assert.match(command.text, /ORDER BY created_at DESC, id DESC/)` 直接比對 SQL 的排序子句（新到舊，`id` 為 tie-break）；「service 未提供任何排序參數介面」由 `buildListCommand(status)`／`listTodos(db, status)` 的簽章即可核對，兩者都只收一個 `status` |
 * | TC-020 | `[TC-020][TC-039] buildUpdateCommand：…` | **完全**：`{ title }` 單獨給值時 `values` 為 `["id-1", "new title", null]`，`null` 代表 `is_completed` 走 `COALESCE` 保留原值；SQL 的 SET 子句本來就不含 `created_at`／`id`／`owner_id` |
 * | TC-030 | `[TC-030] buildDeleteCommand：…` | **完全**：`assert.equal(command.text, "DELETE FROM todos WHERE id = $1")` 為**字面完全相等**比對，任何 `UPDATE … SET is_deleted`／`deleted_at` 的軟刪除寫法都會讓它失敗 |
 * | TC-039 | `[TC-039] setCompleted：…` ＋ `[TC-020][TC-039] buildUpdateCommand：…` | **完全**：只帶 `isCompleted` 時 `values` 為 `["id-1", null, true]`，即異動欄位只含 `is_completed`；「回傳物件無 `completedAt`」由 `[TC-003]`／`[TC-059]` 的 `deepEqual` 四欄位比對佐證 |
 * | TC-048 | `[TC-012][TC-048] buildListCommand：…` | **部分**：TC-048 步驟 2（`all`／`active`／`completed` 三值皆被接受並轉為查詢條件）由迴圈完全覆蓋；步驟 1 的預設值與步驟 3 的非法值拒絕不在資料層，落點與整合層覆蓋見 `todo-service.test.ts` 檔頭同一列 |
 * | TC-059 | `[TC-059] listTodos：把 rows 轉成 camelCase…` ＋ `[TC-003][TC-059] getTodoById：有列時…` | **部分**：TC-059 的重點「**非**本地化字串、**非** epoch 數字」已被釘住——轉換函式把 `created_at`（`timestamptz` → `pg` 驅動回的 JS `Date`）**原樣**搬到 `createdAt`，`deepEqual` 會讓任何 `toLocaleString()`／`getTime()` 的改寫立刻失敗。**「字串以 `Z` 結尾或 `+00:00`」這一句未在 unit 層斷言**：轉換函式回傳的是 `Date` 物件不是字串，ISO 8601／RFC 3339 的字串化發生在 Fastify 序列化階段（`src/schemas/todo-schema.ts` 的 `createdAt` 標 `format: "date-time"`），屬整合層 TC 的覆蓋範圍 |
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildCreateCommand,
  buildDeleteCommand,
  buildGetByIdCommand,
  buildListCommand,
  buildUpdateCommand,
  createTodo,
  deleteTodo,
  getTodoById,
  listTodos,
  setCompleted,
  updateTodo
} from "../../src/repositories/todo-repository.ts";
import type { Queryable, QueryResultLike } from "../../src/repositories/todo-repository.ts";

interface RecordedCall {
  text: string;
  values: unknown[];
}

/** 建立一個不連真實資料庫的 mock：記錄每次呼叫，回應由測試自訂。 */
function createMockDb(
  respond: (call: RecordedCall) => { rows: unknown[]; rowCount?: number | null }
): Queryable & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  return {
    calls,
    async query<T = Record<string, unknown>>(
      text: string,
      values: unknown[] = []
    ): Promise<QueryResultLike<T>> {
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

// ---------------------------------------------------------------------------
// 阻擋級 CR 判準（機械式重現 05_資料庫設計.md §3 末）
// ---------------------------------------------------------------------------

test("阻擋級 CR 判準：repository 原始碼內不得出現樣板字串插值 ${", () => {
  const filePath = fileURLToPath(
    new URL("../../src/repositories/todo-repository.ts", import.meta.url)
  );
  const source = readFileSync(filePath, "utf8");

  assert.equal(
    source.includes("$" + "{"),
    false,
    "repository 檔案內出現 ${，違反 05_資料庫設計.md §3 末的阻擋級 CR 判準"
  );
});

// ---------------------------------------------------------------------------
// 純 SQL 組裝（文字與參數），不碰任何 I/O
// ---------------------------------------------------------------------------

test("[TC-012][TC-048] buildListCommand：$1 帶 status，無論哪個 status 都只有一個參數", () => {
  for (const status of ["all", "active", "completed"] as const) {
    const command = buildListCommand(status);
    assert.deepEqual(command.values, [status]);
    assert.match(command.text, /ORDER BY created_at DESC, id DESC/);
    assert.equal(command.text.includes("${"), false);
  }
});

test("buildGetByIdCommand：$1 帶 id", () => {
  const command = buildGetByIdCommand("id-1");
  assert.deepEqual(command.values, ["id-1"]);
  assert.match(command.text, /WHERE id = \$1/);
});

test("buildCreateCommand：$1 帶 title，SQL 對 title 做 btrim", () => {
  const command = buildCreateCommand("  buy milk  ");
  assert.deepEqual(command.values, ["  buy milk  "]);
  assert.match(command.text, /btrim\(\$1\)/);
  assert.match(command.text, /RETURNING id, title, is_completed, created_at/);
});

test("[TC-020][TC-039] buildUpdateCommand：$1=id、$2=title、$3=isCompleted，缺的欄位為 null（COALESCE 保留原值）", () => {
  const both = buildUpdateCommand("id-1", { title: "new title", isCompleted: true });
  assert.deepEqual(both.values, ["id-1", "new title", true]);

  const onlyStatus = buildUpdateCommand("id-1", { isCompleted: false });
  assert.deepEqual(onlyStatus.values, ["id-1", null, false]);

  const empty = buildUpdateCommand("id-1", {});
  assert.deepEqual(empty.values, ["id-1", null, null]);
});

test("[TC-030] buildDeleteCommand：$1 帶 id", () => {
  const command = buildDeleteCommand("id-1");
  assert.deepEqual(command.values, ["id-1"]);
  assert.equal(command.text, "DELETE FROM todos WHERE id = $1");
});

// ---------------------------------------------------------------------------
// repository 函式：呼叫 Queryable 的方式、snake_case → camelCase 對應、
// 0 列／不存在時的行為
// ---------------------------------------------------------------------------

test("[TC-059] listTodos：把 rows 轉成 camelCase，並把 status 原樣傳給 $1", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  const todos = await listTodos(db, "active");

  assert.equal(db.calls.length, 1);
  assert.deepEqual(db.calls[0]?.values, ["active"]);
  assert.deepEqual(todos, [
    {
      id: SAMPLE_RAW_ROW.id,
      title: SAMPLE_RAW_ROW.title,
      isCompleted: SAMPLE_RAW_ROW.is_completed,
      createdAt: SAMPLE_RAW_ROW.created_at
    }
  ]);
});

test("getTodoById：0 列回傳 null（不存在）", async () => {
  const db = createMockDb(() => ({ rows: [] }));

  const todo = await getTodoById(db, "no-such-id");

  assert.equal(todo, null);
});

test("[TC-003][TC-059] getTodoById：有列時回傳 camelCase 物件", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  const todo = await getTodoById(db, SAMPLE_RAW_ROW.id);

  assert.deepEqual(todo, {
    id: SAMPLE_RAW_ROW.id,
    title: SAMPLE_RAW_ROW.title,
    isCompleted: SAMPLE_RAW_ROW.is_completed,
    createdAt: SAMPLE_RAW_ROW.created_at
  });
});

test("[TC-003] createTodo：RETURNING 有列時回傳 camelCase 物件", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  const todo = await createTodo(db, "buy milk");

  assert.equal(db.calls[0]?.values[0], "buy milk");
  assert.equal(todo.id, SAMPLE_RAW_ROW.id);
});

test("createTodo：RETURNING 未回傳任何列時視為資料層異常並拋出", async () => {
  const db = createMockDb(() => ({ rows: [] }));

  await assert.rejects(() => createTodo(db, "buy milk"));
});

test("updateTodo：查無此 id（0 列）回傳 null", async () => {
  const db = createMockDb(() => ({ rows: [] }));

  const todo = await updateTodo(db, "no-such-id", { title: "x" });

  assert.equal(todo, null);
});

test("[TC-039] setCompleted：委派給 updateTodo，只帶 isCompleted（title 為 null）", async () => {
  const db = createMockDb(() => ({ rows: [SAMPLE_RAW_ROW] }));

  await setCompleted(db, "id-1", true);

  assert.deepEqual(db.calls[0]?.values, ["id-1", null, true]);
});

test("deleteTodo：rowCount > 0 回傳 true", async () => {
  const db = createMockDb(() => ({ rows: [], rowCount: 1 }));

  assert.equal(await deleteTodo(db, "id-1"), true);
});

test("deleteTodo：rowCount 為 0 或 null 回傳 false（不存在，非錯誤）", async () => {
  const zero = createMockDb(() => ({ rows: [], rowCount: 0 }));
  assert.equal(await deleteTodo(zero, "id-1"), false);

  const nullCount = createMockDb(() => ({ rows: [], rowCount: null }));
  assert.equal(await deleteTodo(nullCount, "id-1"), false);
});
