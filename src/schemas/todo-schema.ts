/**
 * src/schemas/todo-schema.ts（BE-04 todo-api：與 04_API規格.yaml 共用同一套
 * JSON Schema）
 *
 * 本檔只描述「形狀」（型別、長度、格式、必填），供 Fastify 的 ajv 驗證器
 * 在進入路由 handler 之前擋掉明顯不合法的請求；**業務規則（trim 後再驗
 * 一次長度、PATCH 至少一個欄位）不在本檔**，唯一落點是
 * `src/services/todo-service.ts`（BE-05，WBS §1.6 背景與限制末段）。
 *
 * - `title` 的 `minLength: 1` 擋不掉全空白字串 `"   "`（長度不為 0），
 *   這正是業務層必須在 `trim()` 之後再驗一次的原因（BR-001、BR-002）。
 * - `additionalProperties: false` 搭配 Fastify 預設 ajv 選項
 *   `removeAdditional: true`（`@fastify/ajv-compiler` 預設值）：
 *   ajv 在檢查 `additionalProperties` 之前先移除未宣告欄位，因此夾帶的
 *   `id`／`createdAt`／`ownerId`／`isCompleted`（PATCH 之外）等欄位一律被
 *   「忽略」而非「拒絕」（BR-012；也是 04_API規格.yaml 的既有用語）。
 * - `todoId` 路徑參數 `format: "uuid"` 由 ajv-formats（Fastify 內建）驗證；
 *   格式不合法時走 `error-handler.ts` 的 `isValidationError` 分支回
 *   `400 E_VALIDATION`，格式合法但查無資料則由 `todo-service.ts` 丟
 *   `AppError("E_NOT_FOUND", ...)` 回 `404`（SD §5 第 6 點：分界寫死；
 *   WBS §1.6 驗收：`curl .../not-a-uuid` 斷言 `400`）。
 * - `createdAt` 回應為 `type: "string", format: "date-time"`：
 *   `todo-repository.ts` 回傳的 `createdAt` 是 `Date` 物件，
 *   `fast-json-stringify` 對 `format: "date-time"` 欄位遇到 `Date`
 *   實例會自動呼叫 `toISOString()`（實測見
 *   `node_modules/fast-json-stringify/lib/serializer.js`），因此
 *   **不得在 service 層再手動 `toISOString()` 一次**（T-0013 交接檔
 *   「下一步建議」1 的交辦；否則會出現兩處格式化邏輯）。
 */

export const StatusFilterQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["all", "active", "completed"],
      default: "all"
    }
  }
} as const;

export const TodoIdParamsSchema = {
  type: "object",
  required: ["todoId"],
  additionalProperties: false,
  properties: {
    todoId: {
      type: "string",
      format: "uuid"
    }
  }
} as const;

export const CreateTodoRequestSchema = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      minLength: 1,
      maxLength: 200
    }
  }
} as const;

export const UpdateTodoRequestSchema = {
  type: "object",
  minProperties: 1,
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      minLength: 1,
      maxLength: 200
    },
    isCompleted: {
      type: "boolean"
    }
  }
} as const;

/** 對應 04_API規格.yaml components.schemas.Todo。`updatedAt` 依 O-008 不進本契約。 */
export const TodoResponseSchema = {
  type: "object",
  required: ["id", "title", "isCompleted", "createdAt"],
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      format: "uuid"
    },
    title: {
      type: "string"
    },
    isCompleted: {
      type: "boolean"
    },
    createdAt: {
      type: "string",
      format: "date-time"
    }
  }
} as const;

export const TodoListResponseSchema = {
  type: "array",
  items: TodoResponseSchema
} as const;
