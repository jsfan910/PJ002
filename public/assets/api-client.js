/**
 * public/assets/api-client.js（FE-02 api-client，WI-04／T-0014）
 *
 * `fetch` 包裝，對應 `docs/specs/04_API規格.yaml` 的五個 `/api/v1/todos*` 端點。
 *
 * 規則（WBS §1.4 背景與限制）：
 *   - 一律組 `/api/v1/*` 相對路徑，同源、不寫死網域（O-004、ADR-0004）。
 *   - 解析統一錯誤物件（`Error` schema：code/message/details/requestId）並轉為具名例外。
 *   - 不碰 DOM，不使用 `document`／`window`；只使用全域 `fetch`。
 *   - 不處理 Basic Auth：由瀏覽器對同源請求原生附帶憑證（ADR-0004）。
 *
 * 本模組刻意不管理任何應用程式狀態（那是 FE-03 `todo-store.js`，T-0017／WI-07），
 * 也不假設呼叫者是誰；單向資料流見 SD §3.2：
 *   使用者事件 → controller → api-client（本檔） → todo-store → todo-view
 */

const BASE_PATH = "/api/v1";

/**
 * 對應 04_API規格.yaml 的統一錯誤物件（Error schema）。
 * 由任一非 2xx 回應轉出，帶有伺服器回傳的 code／message／details／requestId，
 * 以及本次 HTTP 狀態碼，方便呼叫端依 code 分支處理。
 */
export class ApiError extends Error {
  constructor({ code, message, details, requestId } = {}, status) {
    super(message || "Request failed");
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.status = status;
  }
}

/**
 * 網路層失敗（斷線、逾時、DNS 失敗等 `fetch` 直接拋出例外的情況），
 * 或伺服器回應無法解析為 JSON 時的情況。與 `ApiError`（伺服器已回應但為錯誤狀態碼）區分，
 * 讓呼叫端可以分別顯示「連不上伺服器」與「伺服器回報的錯誤」。
 */
export class NetworkError extends Error {
  constructor(cause) {
    super("Network request failed");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

function buildUrl(path, query) {
  if (!query) {
    return path;
  }
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return params.length > 0 ? `${path}?${params.join("&")}` : path;
}

async function request(method, path, { query, body } = {}) {
  const url = buildUrl(path, query);
  const hasBody = body !== undefined;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(body) : undefined
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (response.status === 204) {
    return undefined;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) {
      // 成功狀態碼但沒有可解析的 JSON 本文，視為契約外情況，交由呼叫端判斷。
      return undefined;
    }
    // 錯誤狀態碼卻沒有可解析的 Error 本文，仍要讓呼叫端拿到具名例外而非原始例外。
    throw new ApiError(
      { code: "E_INTERNAL", message: "Internal Server Error" },
      response.status
    );
  }

  if (!response.ok) {
    throw new ApiError(payload, response.status);
  }

  return payload;
}

/**
 * UC-002／UC-006／UC-007：查詢待辦清單，可帶狀態篩選。
 * `status` 省略時交由後端套用預設值 `all`（04_API規格.yaml `StatusFilter`）。
 * @param {"all"|"active"|"completed"} [status]
 * @returns {Promise<Array<{id:string,title:string,isCompleted:boolean,createdAt:string}>>}
 */
export function listTodos(status) {
  return request("GET", `${BASE_PATH}/todos`, { query: status ? { status } : undefined });
}

/**
 * UC-001：新增待辦。伺服器產生 `id`／`createdAt`，`isCompleted` 恆為 `false`（BR-003、BR-006）。
 * @param {string} title
 * @returns {Promise<{id:string,title:string,isCompleted:boolean,createdAt:string}>}
 */
export function createTodo(title) {
  return request("POST", `${BASE_PATH}/todos`, { body: { title } });
}

/**
 * UC-009：查詢單筆待辦。
 * @param {string} id
 * @returns {Promise<{id:string,title:string,isCompleted:boolean,createdAt:string}>}
 */
export function getTodoById(id) {
  return request("GET", `${BASE_PATH}/todos/${encodeURIComponent(id)}`);
}

/**
 * UC-003／UC-005：更新標題與／或完成狀態。`isCompleted` 為設定目標狀態，非 toggle（O-002）。
 * `patch` 至少要有一個欄位，否則後端回 400（E_VALIDATION）。
 * @param {string} id
 * @param {{title?: string, isCompleted?: boolean}} patch
 * @returns {Promise<{id:string,title:string,isCompleted:boolean,createdAt:string}>}
 */
export function updateTodo(id, patch) {
  return request("PATCH", `${BASE_PATH}/todos/${encodeURIComponent(id)}`, { body: patch });
}

/**
 * UC-004：刪除待辦（硬刪除）。成功回 204 無回應本文。
 * @param {string} id
 * @returns {Promise<undefined>}
 */
export function deleteTodo(id) {
  return request("DELETE", `${BASE_PATH}/todos/${encodeURIComponent(id)}`);
}
