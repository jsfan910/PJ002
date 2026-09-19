/**
 * tests/integration/todo-repository.test.ts
 *
 * 對本機 compose Postgres 實跑的整合測試（WBS §1.3 acceptance 第 5 條）。
 * 匯入路徑指向 `dist/`（已編譯輸出），沿用 `tests/integration/health.test.ts`
 * 的既有慣例（`worklog/handoff/20260919-0817-T0011-r1-dev-tl.md`
 * 「下一步建議」1）：Node 的原生 TypeScript 型別剝除不會把 `.js` 匯入
 * 規格回頭解析成同名 `.ts`（那是 TS 5.7 才有的
 * `rewriteRelativeImportExtensions`，本專案釘選 `~5.6`），因此本測試依賴
 * 驗收流程中「先 `npm run build` 再跑測試」的順序。
 *
 * **無 DB 環境的處理方式**（本輪開工時本機 Docker daemon 不可用，見
 * 交接檔）：開測前先探測 `DATABASE_URL` 是否可連線；連不上就以
 * `node:test` 的 `skip` 選項整批跳過並印出原因，**不假裝通過**。
 * dev-tl 或 CI 在 Docker 可用時（`docker compose up -d db` 後）重跑本檔
 * 即可補驗。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";

import { createPool } from "../../dist/db/pool.js";
import { runMigrations } from "../../dist/db/migrate.js";
import {
  createTodo,
  deleteTodo,
  getTodoById,
  listTodos,
  setCompleted,
  updateTodo
} from "../../dist/repositories/todo-repository.js";

// 本檔不依賴 src/config.ts 的完整驗證（不需要 BASIC_AUTH_* 等），
// 直接讀 DATABASE_URL；預設值對應 docker-compose.yml 的 db 服務，
// 從「host 機器」連線用 localhost（compose 已把 5432 對外映射），
// 容器內互連才用服務名 `db`（見 .env.example 註解）。
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://dev:dev@localhost:5432/todo";
const CONNECT_TIMEOUT_MS = 3000;

async function probeDatabase(): Promise<{ available: boolean; reason: string }> {
  const probePool = new Pool({
    connectionString: DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS
  });
  try {
    await probePool.query("SELECT 1");
    return { available: true, reason: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      reason: `無法連線到 DATABASE_URL=${DATABASE_URL}：${message}（本機 Docker daemon 目前不可用時預期如此；` +
        "請先 docker compose up -d db 再重跑本檔）"
    };
  } finally {
    await probePool.end().catch(() => undefined);
  }
}

const { available: dbAvailable, reason: skipReason } = await probeDatabase();

if (!dbAvailable) {
  console.log(`[SKIP] tests/integration/todo-repository.test.ts：${skipReason}`);
}

const skip = dbAvailable ? false : skipReason;
const pool = dbAvailable ? createPool({ databaseUrl: DATABASE_URL }) : null;

test.before(async () => {
  if (!dbAvailable || pool === null) {
    return;
  }
  // migration 冪等：即使 001 已套用過，這裡再跑一次也是 no-op。
  await runMigrations(pool);
});

test.after(async () => {
  await pool?.end();
});

test("create → getById 讀回同一筆，欄位為 camelCase", { skip }, async () => {
  const created = await createTodo(pool!, "buy milk");

  assert.equal(created.title, "buy milk");
  assert.equal(created.isCompleted, false);
  assert.ok(created.createdAt instanceof Date);

  const fetched = await getTodoById(pool!, created.id);
  assert.deepEqual(fetched, created);
});

test("getById 查無資料回傳 null（由呼叫端轉 404）", { skip }, async () => {
  const result = await getTodoById(pool!, "00000000-0000-4000-8000-000000000000");
  assert.equal(result, null);
});

test("update：可只改標題、只改完成狀態，或兩者都改（COALESCE 保留未提供欄位）", { skip }, async () => {
  const created = await createTodo(pool!, "original title");

  const titleOnly = await updateTodo(pool!, created.id, { title: "new title" });
  assert.equal(titleOnly?.title, "new title");
  assert.equal(titleOnly?.isCompleted, false);

  const statusOnly = await setCompleted(pool!, created.id, true);
  assert.equal(statusOnly?.title, "new title");
  assert.equal(statusOnly?.isCompleted, true);

  // isCompleted 是設定目標狀態、非 toggle（O-002）：重送同值仍為 true（冪等）。
  const idempotentRepeat = await setCompleted(pool!, created.id, true);
  assert.equal(idempotentRepeat?.isCompleted, true);
});

test("update：查無此 id 回傳 null", { skip }, async () => {
  const result = await updateTodo(pool!, "00000000-0000-4000-8000-000000000000", { title: "x" });
  assert.equal(result, null);
});

test("delete：刪除存在的資料回 true，再刪一次回 false（不存在非錯誤）", { skip }, async () => {
  const created = await createTodo(pool!, "to be deleted");

  assert.equal(await deleteTodo(pool!, created.id), true);
  assert.equal(await deleteTodo(pool!, created.id), false);
  assert.equal(await getTodoById(pool!, created.id), null);
});

test("list：status 篩選在 SQL WHERE 做（active／completed／all）", { skip }, async () => {
  const active = await createTodo(pool!, "list-filter-active");
  const completed = await createTodo(pool!, "list-filter-completed");
  await setCompleted(pool!, completed.id, true);

  const activeList = await listTodos(pool!, "active");
  assert.ok(activeList.some((todo: { id: string }) => todo.id === active.id));
  assert.ok(!activeList.some((todo: { id: string }) => todo.id === completed.id));

  const completedList = await listTodos(pool!, "completed");
  assert.ok(completedList.some((todo: { id: string }) => todo.id === completed.id));
  assert.ok(!completedList.some((todo: { id: string }) => todo.id === active.id));

  const allList = await listTodos(pool!, "all");
  assert.ok(allList.some((todo: { id: string }) => todo.id === active.id));
  assert.ok(allList.some((todo: { id: string }) => todo.id === completed.id));

  await deleteTodo(pool!, active.id);
  await deleteTodo(pool!, completed.id);
});

test(
  "list：500 筆同秒建立（同一 created_at）後排序仍為決定性（created_at DESC, id DESC，NFR-007）",
  { skip },
  async () => {
    const ROW_COUNT = 500;
    const fixedCreatedAt = new Date("2026-01-01T00:00:00.000000Z");

    // 直接以 SQL 插入並顯式指定 created_at（INSERT 沒有 BEFORE INSERT
    // 觸發器擋這件事，`todos_protect_created_at` 只在 BEFORE UPDATE 生效）
    // ——刻意讓 500 筆的 created_at 完全相同，逼出 tie-break 是否決定性。
    const values: unknown[] = [];
    const placeholders: string[] = [];
    for (let i = 0; i < ROW_COUNT; i += 1) {
      placeholders.push(`($${String(i * 2 + 1)}, $${String(i * 2 + 2)})`);
      values.push(`tie-break-${String(i)}`, fixedCreatedAt);
    }
    const insertSql =
      "INSERT INTO todos (title, created_at) VALUES " +
      placeholders.join(", ") +
      " RETURNING id";
    const insertResult = await pool!.query<{ id: string }>(insertSql, values);
    const insertedIds = insertResult.rows.map((row) => row.id);
    assert.equal(insertedIds.length, ROW_COUNT);

    const expectedDescOrder = [...insertedIds].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

    const allTodos = await listTodos(pool!, "all");

    // 整份清單必須是全域決定性排序：任兩個相鄰元素都不得逆序
    // （created_at DESC 為主、id DESC 為輔），無論表裡還有多少其他資料。
    for (let i = 1; i < allTodos.length; i += 1) {
      const prev = allTodos[i - 1]!;
      const curr = allTodos[i]!;
      const prevKey = [prev.createdAt.getTime(), prev.id] as const;
      const currKey = [curr.createdAt.getTime(), curr.id] as const;
      const isNonIncreasing =
        prevKey[0] > currKey[0] || (prevKey[0] === currKey[0] && prevKey[1] >= currKey[1]);
      assert.ok(
        isNonIncreasing,
        `排序非決定性：第 ${String(i - 1)} 筆與第 ${String(i)} 筆順序錯誤`
      );
    }

    // 專門檢查這 500 筆同秒資料彼此之間的順序：必須完全等於依 id 字典序
    // 由大到小排列（created_at 相同時的 tie-break，斷言可寫死到「與插入
    // 時回傳的 id 集合排序結果一致」這個決定性規則）。
    const insertedIdSet = new Set(insertedIds);
    const actualOrderAmongInserted = allTodos
      .filter((todo: { id: string }) => insertedIdSet.has(todo.id))
      .map((todo: { id: string }) => todo.id);
    assert.deepEqual(actualOrderAmongInserted, expectedDescOrder);

    await Promise.all(insertedIds.map((id) => deleteTodo(pool!, id)));
  }
);

test(
  "DB 層第二道防線：全空白標題違反 CHECK 約束（即使繞過業務層直接呼叫 repository）",
  { skip },
  async () => {
    await assert.rejects(
      () => createTodo(pool!, "   "),
      (err: unknown) => {
        const pgErr = err as { code?: string };
        assert.equal(pgErr.code, "23514"); // check_violation
        return true;
      }
    );
  }
);
