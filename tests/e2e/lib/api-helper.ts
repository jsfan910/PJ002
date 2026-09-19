/**
 * tests/e2e/lib/api-helper.ts
 * T-0021（qa-at）：e2e 測試的前置條件／清理輔助，直接對 API 發真實 HTTP，
 * 不透過瀏覽器（快、且與畫面操作互不干擾）。憑證讀環境變數，見
 * `tests/e2e/playwright.config.ts` 檔頭說明。
 */
export const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const USER = process.env.STAGING_BASIC_AUTH_USER ?? process.env.BASIC_AUTH_USER ?? "dev";
const PASSWORD = process.env.STAGING_BASIC_AUTH_PASSWORD ?? process.env.BASIC_AUTH_PASSWORD ?? "dev";
export const AUTH_HEADER = `Basic ${Buffer.from(`${USER}:${PASSWORD}`, "utf-8").toString("base64")}`;

export interface Todo {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
}

export async function apiCreate(title: string): Promise<Todo> {
  const response = await fetch(`${BASE_URL}/api/v1/todos`, {
    method: "POST",
    headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
    body: JSON.stringify({ title })
  });
  if (response.status !== 201) {
    throw new Error(`前置建立失敗：${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<Todo>;
}

export async function apiList(): Promise<Todo[]> {
  const response = await fetch(`${BASE_URL}/api/v1/todos`, { headers: { authorization: AUTH_HEADER } });
  return response.json() as Promise<Todo[]>;
}

export async function apiDelete(id: string): Promise<void> {
  await fetch(`${BASE_URL}/api/v1/todos/${id}`, { method: "DELETE", headers: { authorization: AUTH_HEADER } });
}

export async function apiSetCompleted(id: string, isCompleted: boolean): Promise<void> {
  await fetch(`${BASE_URL}/api/v1/todos/${id}`, {
    method: "PATCH",
    headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
    body: JSON.stringify({ isCompleted })
  });
}

/** 每個 e2e test 開頭呼叫，確保清單為空、互不干擾（e2e 不平行執行，見 playwright.config.ts）。 */
export async function apiClearAll(): Promise<void> {
  const todos = await apiList();
  await Promise.all(todos.map((todo) => apiDelete(todo.id)));
}
