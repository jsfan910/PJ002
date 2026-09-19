/**
 * src/repositories/todo-repository.ts（BE-06 todo-repository）
 *
 * 對 `todos` 表的全部參數化查詢。**唯一**的 `snake_case` ↔ `camelCase`
 * 轉換位置（ADR-0002 決定 6）；狀態篩選在 SQL WHERE 做（Leader 裁決
 * O-003）；清單一律 `ORDER BY created_at DESC, id DESC`（tie-break，
 * NFR-007）。
 *
 * **阻擋級 CR 判準**（05_資料庫設計.md §3 末）：本檔任何 SQL 字串內
 * 不得出現 `$` 後接 `{` 的樣板字串插值——一律用 `$1`/`$2`/... 參數化，
 * 值永遠透過 `values` 陣列傳遞，不做任何字串拼接。因此本檔的每一段
 * SQL 文字都是純字面常數（即使用到反引號多行字串，也不含任何樣板
 * 字串插值語法）；欄位清單等重複片段刻意逐條寫出而非以插值共用，
 * 就是為了讓這條 CR 判準可以機械式地用 `grep` 逐字掃到。
 */

/** repository 依賴的最小介面：只要求 `query`，方便單元測試以不連真實
 *  資料庫的 mock 物件取代整個 `pg.Pool`（`pg.Pool`／`PoolClient` 皆結構相容）。 */
export interface QueryResultLike<T> {
  rows: T[];
  rowCount: number | null;
}

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResultLike<T>>;
}

export type StatusFilter = "all" | "active" | "completed";

/** API 層物件（camelCase）。`createdAt` 保留為 `Date`：交給上層 JSON
 *  序列化時會自動轉為 ISO 8601／RFC 3339（含時區）字串，符合 BR-004。
 *  `updated_at`／`owner_id` 為維運欄位，依 O-008 不進本介面。 */
export interface TodoRow {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: Date;
}

/** `update`／`setCompleted` 的可更新欄位；皆為選填，未提供的欄位維持原值
 *  （由 SQL 的 `COALESCE` 落實）。是否至少要有一個欄位，由業務層（BE-05）
 *  驗證，本層不擋。 */
export interface TodoPatch {
  title?: string;
  isCompleted?: boolean;
}

interface RawTodoRow {
  id: string;
  title: string;
  is_completed: boolean;
  created_at: Date;
}

function mapRow(row: RawTodoRow): TodoRow {
  return {
    id: row.id,
    title: row.title,
    isCompleted: row.is_completed,
    createdAt: row.created_at
  };
}

interface SqlCommand {
  text: string;
  values: unknown[];
}

/**
 * 清單查詢（UC-002／UC-006／UC-007）。`$1` = `'all' | 'active' | 'completed'`。
 * 篩選在 SQL WHERE 做（O-003）；排序含 tie-break（ADR-0002 決定 2）。
 */
export function buildListCommand(status: StatusFilter): SqlCommand {
  return {
    text: `SELECT id, title, is_completed, created_at
  FROM todos
 WHERE ($1 = 'all')
    OR ($1 = 'active'    AND is_completed = false)
    OR ($1 = 'completed' AND is_completed = true)
 ORDER BY created_at DESC, id DESC`,
    values: [status]
  };
}

/** 單筆讀取（UC-003～UC-005）。0 列即不存在，由呼叫端轉為 404。 */
export function buildGetByIdCommand(id: string): SqlCommand {
  return {
    text: "SELECT id, title, is_completed, created_at FROM todos WHERE id = $1",
    values: [id]
  };
}

/** 建立（UC-001）。`id`／`created_at` 由資料庫產生，應用層不送。
 *  `btrim($1)` 是第二道防線（第一道在業務層 BE-05 的 `trim()`）。 */
export function buildCreateCommand(title: string): SqlCommand {
  return {
    text: `INSERT INTO todos (title)
VALUES (btrim($1))
RETURNING id, title, is_completed, created_at`,
    values: [title]
  };
}

/**
 * 更新標題與／或完成狀態（UC-003／UC-005）。`COALESCE` 讓兩欄位皆為
 * 選填；未提供的欄位傳 `null` 使 `COALESCE` 保留原值。`isCompleted` 是
 * 「設定目標狀態」而非 toggle（O-002），故本命令是冪等的。
 */
export function buildUpdateCommand(id: string, patch: TodoPatch): SqlCommand {
  return {
    text: `UPDATE todos
   SET title        = COALESCE(btrim($2), title),
       is_completed = COALESCE($3, is_completed)
 WHERE id = $1
RETURNING id, title, is_completed, created_at`,
    values: [id, patch.title ?? null, patch.isCompleted ?? null]
  };
}

/** 刪除（UC-004）。硬刪除；影響列數為 0 即代表不存在（BR-008／BR-009）。 */
export function buildDeleteCommand(id: string): SqlCommand {
  return {
    text: "DELETE FROM todos WHERE id = $1",
    values: [id]
  };
}

export async function listTodos(db: Queryable, status: StatusFilter): Promise<TodoRow[]> {
  const { text, values } = buildListCommand(status);
  const result = await db.query<RawTodoRow>(text, values);
  return result.rows.map(mapRow);
}

export async function getTodoById(db: Queryable, id: string): Promise<TodoRow | null> {
  const { text, values } = buildGetByIdCommand(id);
  const result = await db.query<RawTodoRow>(text, values);
  const row = result.rows[0];
  return row === undefined ? null : mapRow(row);
}

export async function createTodo(db: Queryable, title: string): Promise<TodoRow> {
  const { text, values } = buildCreateCommand(title);
  const result = await db.query<RawTodoRow>(text, values);
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error("INSERT ... RETURNING 未回傳任何列，資料層異常");
  }
  return mapRow(row);
}

/** 更新標題與／或完成狀態；查無此 id 回傳 `null`（由呼叫端轉 404）。 */
export async function updateTodo(
  db: Queryable,
  id: string,
  patch: TodoPatch
): Promise<TodoRow | null> {
  const { text, values } = buildUpdateCommand(id, patch);
  const result = await db.query<RawTodoRow>(text, values);
  const row = result.rows[0];
  return row === undefined ? null : mapRow(row);
}

/** `update` 的專用薄封裝：只設定完成狀態，語意上是「設定目標狀態」
 *  而非 toggle（O-002）。查無此 id 回傳 `null`。 */
export async function setCompleted(
  db: Queryable,
  id: string,
  isCompleted: boolean
): Promise<TodoRow | null> {
  return updateTodo(db, id, { isCompleted });
}

/** 刪除；回傳是否確實存在過（影響列數 > 0）。不存在時**不得**視為錯誤、
 *  **不得**建立新資料、**不得**回 5xx（BR-009，由呼叫端依此回 404）。 */
export async function deleteTodo(db: Queryable, id: string): Promise<boolean> {
  const { text, values } = buildDeleteCommand(id);
  const result = await db.query(text, values);
  return (result.rowCount ?? 0) > 0;
}
