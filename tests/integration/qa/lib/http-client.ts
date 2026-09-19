/**
 * tests/integration/qa/lib/http-client.ts
 *
 * T-0021（qa-at）：`tests/integration/qa/**` 共用的 HTTP 用戶端。
 *
 * 與既有 `tests/integration/*.test.ts`（dev-be／dev-fe 撰寫，`app.inject()`
 * 匯入 `../../dist/...`）刻意採不同策略：本目錄一律以真實 HTTP 呼叫
 * `$BASE_URL`（預設 `http://localhost:8080`，即本機 `docker compose` 服務），
 * 不匯入 `dist/`、不需要先 `npm run build`。理由（任務卡「現實條件」）：
 * staging 尚未部署，測試程式必須能只換環境變數就對 staging 重跑，不改碼。
 *
 * 認證優先序：`STAGING_BASIC_AUTH_USER`／`STAGING_BASIC_AUTH_PASSWORD`
 * （staging 用）> `BASIC_AUTH_USER`／`BASIC_AUTH_PASSWORD`（本機 compose，
 * `.env.example` 佔位值 `dev`/`dev`）。憑證一律不落地字面值（07 §6.2）。
 */
import assert from "node:assert/strict";

export const BASE_URL = (process.env.BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");

const USER = process.env.STAGING_BASIC_AUTH_USER ?? process.env.BASIC_AUTH_USER ?? "dev";
const PASSWORD = process.env.STAGING_BASIC_AUTH_PASSWORD ?? process.env.BASIC_AUTH_PASSWORD ?? "dev";

export const AUTH_HEADER = `Basic ${Buffer.from(`${USER}:${PASSWORD}`, "utf-8").toString("base64")}`;

/** staging 是否就緒：任務卡「現實條件」——尚未部署時，staging 依存 TC 一律記「阻擋（環境未就緒）」而非不通過。 */
export const STAGING_READY = Boolean(
  process.env.STAGING_BASE_URL && /^https:\/\//.test(process.env.STAGING_BASE_URL)
);

export interface ApiResponse<T = unknown> {
  status: number;
  headers: Headers;
  bodyText: string;
  json(): T;
}

async function toApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const bodyText = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    bodyText,
    json(): T {
      return bodyText.length === 0 ? (undefined as T) : (JSON.parse(bodyText) as T);
    }
  };
}

export interface RequestOptions {
  auth?: boolean;
  headers?: Record<string, string>;
  body?: unknown;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { auth = true, headers = {}, body } = options;
  const finalHeaders: Record<string, string> = { ...headers };
  if (auth) {
    finalHeaders.authorization = AUTH_HEADER;
  }
  let payload: string | undefined;
  if (body !== undefined) {
    finalHeaders["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: payload
  });
  return toApiResponse<T>(response);
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options)
};

export interface Todo {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
}

/** 建立一筆測試資料，回傳完整 Todo；供各 TC 的前置條件使用。 */
export async function createTodo(title: string): Promise<Todo> {
  const response = await http.post<Todo>("/api/v1/todos", { title });
  assert.equal(response.status, 201, `建立前置資料失敗：${response.bodyText}`);
  return response.json();
}

export async function deleteTodo(id: string): Promise<void> {
  await http.delete(`/api/v1/todos/${id}`);
}

export const NON_EXISTENT_ID = "00000000-0000-4000-8000-000000000000";

/** 等待服務就緒（等效 `npm run verify:health`），供整合測試檔開頭防呆用。 */
export async function waitForHealth(timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.status === 200) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`服務在 ${timeoutMs}ms 內未就緒（BASE_URL=${BASE_URL}）：${String(lastError)}`);
}
