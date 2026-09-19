/**
 * src/routes/todos.ts（BE-04 todo-api）
 *
 * 註冊 `/api/v1/todos` 五個端點（UC-001~UC-007、UC-009）。本檔**只**做
 * schema 驗證（`todo-schema.ts`）與序列化，**業務規則的唯一落點是
 * `todo-service.ts`**（BE-05，WBS §1.6 末段）。所有錯誤一律
 * `throw new AppError(...)`（由 service 層丟出）交給全域
 * `error-handler.ts`（WI-02）序列化，本檔不呼叫 `setErrorHandler`，
 * 也不自行組錯誤回應本文。
 *
 * 連線池：本檔於註冊時以 `createPool(config)` 建立一次（不是每請求都
 * 建立），並以 `onClose` hook 隨 app 生命週期關閉——`src/server.ts`／
 * `src/app.ts` 皆不在本卡 outputs 內，因此池的關閉自行在本檔完成，
 * 不依賴上層額外程式碼。
 *
 * 於 `src/app.ts` 的 `[ANCHOR:routes]` 直接呼叫（不經巢狀 `app.register`
 * 另建子情境，維持與 basic-auth／error-handler／static 一致的呼叫風格；
 * 路由本身仍由 Fastify 內部管理其 schema 編譯，與是否巢狀無關）。
 */
import type { FastifyInstance, FastifyReply } from "fastify";

import type { AppConfig } from "../config.js";
import { createPool } from "../db/pool.js";
import type { StatusFilter } from "../repositories/todo-repository.js";
import {
  CreateTodoRequestSchema,
  StatusFilterQuerystringSchema,
  TodoIdParamsSchema,
  TodoListResponseSchema,
  TodoResponseSchema,
  UpdateTodoRequestSchema
} from "../schemas/todo-schema.js";
import { createTodo, deleteTodo, getTodoById, listTodos, updateTodo } from "../services/todo-service.js";

interface TodoIdParams {
  todoId: string;
}

interface StatusQuerystring {
  status?: StatusFilter;
}

interface CreateTodoBody {
  title: string;
}

interface UpdateTodoBody {
  title?: string;
  isCompleted?: boolean;
}

const TODOS_PATH = "/api/v1/todos";
const TODO_BY_ID_PATH = "/api/v1/todos/:todoId";

export function registerTodoRoutes(app: FastifyInstance, config: AppConfig): void {
  const pool = createPool(config);
  app.addHook("onClose", async () => {
    await pool.end();
  });

  app.get<{ Querystring: StatusQuerystring }>(
    TODOS_PATH,
    { schema: { querystring: StatusFilterQuerystringSchema, response: { 200: TodoListResponseSchema } } },
    async (request) => {
      const status: StatusFilter = request.query.status ?? "all";
      return listTodos(pool, status);
    }
  );

  app.post<{ Body: CreateTodoBody }>(
    TODOS_PATH,
    { schema: { body: CreateTodoRequestSchema, response: { 201: TodoResponseSchema } } },
    async (request, reply: FastifyReply) => {
      const todo = await createTodo(pool, request.body.title);
      reply.code(201);
      return todo;
    }
  );

  app.get<{ Params: TodoIdParams }>(
    TODO_BY_ID_PATH,
    { schema: { params: TodoIdParamsSchema, response: { 200: TodoResponseSchema } } },
    async (request) => {
      return getTodoById(pool, request.params.todoId);
    }
  );

  app.patch<{ Params: TodoIdParams; Body: UpdateTodoBody }>(
    TODO_BY_ID_PATH,
    {
      schema: {
        params: TodoIdParamsSchema,
        body: UpdateTodoRequestSchema,
        response: { 200: TodoResponseSchema }
      }
    },
    async (request) => {
      return updateTodo(pool, request.params.todoId, request.body);
    }
  );

  app.delete<{ Params: TodoIdParams }>(
    TODO_BY_ID_PATH,
    { schema: { params: TodoIdParamsSchema } },
    async (request, reply: FastifyReply) => {
      await deleteTodo(pool, request.params.todoId);
      reply.code(204);
    }
  );
}

export default registerTodoRoutes;
