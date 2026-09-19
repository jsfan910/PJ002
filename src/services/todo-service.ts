/**
 * src/services/todo-service.ts（BE-05 todo-service）
 *
 * **業務規則的唯一落點**（WBS §1.6、SD §3.1 BE-05）：
 * BR-001／BR-002（`trim()` 後非空、長度 1~200，且 trim 必須早於任何 DB
 * 長度檢查——201~203 字元的標題若先進 DB 會以 PostgreSQL `22001` 走到
 * 500，而不是這裡要求的 400，見 WBS 風險 R-07）、BR-003（`createdAt`
 * 不可變，本層不碰）、BR-006（布林兩態）、BR-007（不寫 `completedAt`，
 * 本層無此欄位可寫）、BR-008／BR-009（不存在回 404，不得因此建立新資料
 * 或回 5xx）、BR-012（PATCH 僅 `title`／`isCompleted` 可編輯，且至少一個
 * 欄位）。
 *
 * 本層不做 UUID 格式驗證——那是 `todo-schema.ts` 的
 * `TodoIdParamsSchema`（`format: "uuid"`）在進入 handler 之前的職責；
 * 格式不合法的請求不會到達這裡（SD §5 第 6 點：格式錯 400、格式對但查無
 * 資料 404，分界寫死）。
 *
 * 找不到資源時一律 `throw new AppError("E_NOT_FOUND", ...)`，交由全域
 * `error-handler.ts`（BE-03）序列化為統一結構，本層不自行組回應本文，
 * 也不吞掉 `null`／`false` 讓它們流到路由層（T-0013 交接檔「下一步建議」
 * 2 的交辦）。
 */
import {
  createTodo as repoCreateTodo,
  deleteTodo as repoDeleteTodo,
  getTodoById as repoGetTodoById,
  listTodos as repoListTodos,
  updateTodo as repoUpdateTodo,
  type Queryable,
  type StatusFilter,
  type TodoPatch,
  type TodoRow
} from "../repositories/todo-repository.js";
import { AppError } from "../schemas/error-schema.js";

const NOT_FOUND_MESSAGE = "Todo not found";

/**
 * `title.trim()` 之後再驗一次長度 1~200（BR-001、BR-002；SD §6.3：
 * schema 的 `minLength` 擋不掉 `"   "`，這是最常漏的一點）。
 * **trim 早於任何長度檢查**，也早於任何交給 DB 的動作（R-07）。
 */
function validateAndTrimTitle(rawTitle: string): string {
  const trimmed = rawTitle.trim();
  if (trimmed.length < 1) {
    throw new AppError("E_VALIDATION", "title must not be empty after trimming", {
      field: "title",
      rule: "minLength"
    });
  }
  if (trimmed.length > 200) {
    throw new AppError("E_VALIDATION", "title must be at most 200 characters", {
      field: "title",
      rule: "maxLength"
    });
  }
  return trimmed;
}

/** UC-002／UC-006／UC-007：篩選在後端做（O-003），排序含 tie-break 已在 repository 層完成。 */
export async function listTodos(db: Queryable, status: StatusFilter): Promise<TodoRow[]> {
  return repoListTodos(db, status);
}

/** UC-001：`id`／`createdAt`／`isCompleted` 由伺服器決定，本函式只接受 `title`。 */
export async function createTodo(db: Queryable, rawTitle: string): Promise<TodoRow> {
  const title = validateAndTrimTitle(rawTitle);
  return repoCreateTodo(db, title);
}

/** UC-003～UC-005、UC-009：不存在回 404（BR-009）。 */
export async function getTodoById(db: Queryable, id: string): Promise<TodoRow> {
  const row = await repoGetTodoById(db, id);
  if (row === null) {
    throw new AppError("E_NOT_FOUND", NOT_FOUND_MESSAGE);
  }
  return row;
}

/** PATCH body（僅選填的 `title`／`isCompleted`，其他欄位已由 schema 的 removeAdditional 忽略）。 */
export interface TodoUpdateInput {
  title?: string;
  isCompleted?: boolean;
}

/**
 * UC-003（改標題）／UC-005（設定目標完成狀態，Leader 裁決 O-002：
 * 冪等，非 toggle）。至少要有一個可更新欄位，否則 400（BR-012；
 * schema 的 `minProperties: 1` 已擋一次，本層再驗一次，避免業務邏輯
 * 依賴上層是否正確設定 schema）。
 */
export async function updateTodo(db: Queryable, id: string, input: TodoUpdateInput): Promise<TodoRow> {
  if (input.title === undefined && input.isCompleted === undefined) {
    throw new AppError("E_VALIDATION", "at least one of title or isCompleted must be provided", {
      field: "body",
      rule: "minProperties"
    });
  }

  const patch: TodoPatch = {};
  if (input.title !== undefined) {
    patch.title = validateAndTrimTitle(input.title);
  }
  if (input.isCompleted !== undefined) {
    patch.isCompleted = input.isCompleted;
  }

  const row = await repoUpdateTodo(db, id, patch);
  if (row === null) {
    throw new AppError("E_NOT_FOUND", NOT_FOUND_MESSAGE);
  }
  return row;
}

/** UC-004：硬刪除（BR-008）。不存在回 404，且不得因此建立新資料、不得回 5xx（BR-009）。 */
export async function deleteTodo(db: Queryable, id: string): Promise<void> {
  const deleted = await repoDeleteTodo(db, id);
  if (!deleted) {
    throw new AppError("E_NOT_FOUND", NOT_FOUND_MESSAGE);
  }
}
