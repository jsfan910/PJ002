/**
 * public/assets/todo-store.js（FE-03 todo-store，WI-07／T-0017）
 *
 * 嚴格單向資料流的「唯一可變更狀態」處（SD §3.2）：
 *   使用者事件 → controller → api-client → todo-store（本檔） → todo-view（只讀，整段重繪）
 *
 * 規則（WBS §1.7 背景與限制）：
 *   - BR-011：任何異動（新增／編輯／切換完成／刪除）成功後，一律以「目前 filter」重新向
 *     後端取清單並整份替換 `state.todos`（不做局部 DOM 補丁；事實來源永遠是後端）。
 *   - BR-010：`filter` 預設 `all`，不寫網址、不持久化（只存在本模組的記憶體狀態）。
 *   - `isCompleted` 一律送「目標值」（PATCH 是設定目標狀態，非 toggle，O-002）；
 *     呼叫端（todo-view）必須直接把使用者想要的最終值傳進來，本檔不做反轉。
 *   - 本檔不碰 DOM（不使用 `document`／`window`），只呼叫 `api-client.js` 與管理記憶體狀態。
 *   - 標題驗證（trim 後長度 1~200）在送出 API 前先做一次，避免不必要的請求，
 *     也避開「原始字串 >200、trim 後 ≤200」被 schema 層擋成 400 的邊界
 *     （T-0016 交接檔下一步建議：新增/編輯前先 trim 並限制 maxlength=200）。
 *
 * 對外介面：
 *   createTodoStore(apiClient?) -> { getState, subscribe, actions }
 *   todoStore：以真實 api-client 建立的預設單例，供 todo-view.js 使用。
 *   單元測試以 `createTodoStore(mockApiClient)` 注入假的 api-client，不需要真實網路。
 */

import * as defaultApiClient from "./api-client.js";
import { ApiError, NetworkError } from "./api-client.js";

export const FILTERS = Object.freeze(["all", "active", "completed"]);
const DEFAULT_FILTER = "all";
const TITLE_MAX_LENGTH = 200;

/**
 * 標題驗證：trim 後長度必須為 1~200（BR-001、BR-002，Leader 裁決 Q-001）。
 * 與後端業務層規則一致，前端先擋可避免不必要的請求與邊界誤判。
 * @param {unknown} rawTitle
 * @returns {{ok: true, value: string} | {ok: false, message: string}}
 */
export function validateTitle(rawTitle) {
  const trimmed = typeof rawTitle === "string" ? rawTitle.trim() : "";
  if (trimmed.length === 0) {
    return { ok: false, message: "標題不可為空白" };
  }
  if (trimmed.length > TITLE_MAX_LENGTH) {
    return { ok: false, message: `標題長度不可超過 ${TITLE_MAX_LENGTH} 字元` };
  }
  return { ok: true, value: trimmed };
}

/**
 * 把任意例外轉為畫面可顯示的錯誤描述，區分「伺服器回報的錯誤」與「連不上伺服器」
 * （AC-008-3：兩者需要不同的可讀文字），並保留 code／requestId 供除錯或未來擴充。
 * @param {unknown} err
 * @returns {{kind: "api"|"network"|"validation"|"unknown", code?: string, message: string, requestId?: string}}
 */
export function toDisplayError(err) {
  if (err instanceof ApiError) {
    return {
      kind: "api",
      code: err.code,
      message: describeApiError(err),
      requestId: err.requestId
    };
  }
  if (err instanceof NetworkError) {
    return {
      kind: "network",
      message: "無法連線到伺服器，請檢查網路連線後重試。"
    };
  }
  return {
    kind: "unknown",
    message: "發生未預期的錯誤，請重試。"
  };
}

function describeApiError(err) {
  switch (err.code) {
    case "E_VALIDATION":
      return err.message || "輸入內容不符合規則，請確認後再試一次。";
    case "E_UNAUTHORIZED":
      return "驗證失敗，請重新整理頁面後再試。";
    case "E_NOT_FOUND":
      return "找不到這筆待辦，可能已被刪除。";
    case "E_INTERNAL":
      return "伺服器發生錯誤，請稍後再試。";
    default:
      return err.message || "發生未預期的錯誤，請重試。";
  }
}

/**
 * 建立一個 todo-store 實例。
 * @param {Pick<typeof defaultApiClient, "listTodos"|"createTodo"|"updateTodo"|"deleteTodo">} [apiClient]
 */
export function createTodoStore(apiClient = defaultApiClient) {
  /** @type {{todos: Array<object>, filter: "all"|"active"|"completed", loading: boolean, error: null | ReturnType<typeof toDisplayError>}} */
  let state = {
    todos: [],
    filter: DEFAULT_FILTER,
    loading: false,
    error: null
  };

  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(patch) {
    state = { ...state, ...patch };
    for (const listener of listeners) {
      listener(state);
    }
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * 依（可選的）filter 向後端整份重新取清單並替換 state.todos（BR-011 的核心）。
   * 不帶參數時沿用目前的 filter（供錯誤後「重試」使用）。
   * @param {"all"|"active"|"completed"} [filter]
   */
  async function load(filter) {
    const targetFilter = filter ?? state.filter;
    setState({ filter: targetFilter, loading: true, error: null });
    try {
      const todos = await apiClient.listTodos(targetFilter);
      setState({ todos, loading: false, error: null });
      return { ok: true };
    } catch (err) {
      setState({ loading: false, error: toDisplayError(err) });
      return { ok: false, error: state.error };
    }
  }

  /**
   * UC-006：切換篩選並以新 filter 重新取清單（BR-010：不寫網址、不持久化）。
   * @param {"all"|"active"|"completed"} filter
   */
  function setFilter(filter) {
    if (!FILTERS.includes(filter)) {
      return Promise.resolve({ ok: false, error: toDisplayError(new Error("invalid filter")) });
    }
    return load(filter);
  }

  /**
   * UC-001：新增待辦。標題先驗證，通過才呼叫 API；成功後整份重新取清單（BR-011）。
   * @param {string} rawTitle
   */
  async function add(rawTitle) {
    const validation = validateTitle(rawTitle);
    if (!validation.ok) {
      setState({ error: { kind: "validation", code: "E_VALIDATION", message: validation.message } });
      return { ok: false };
    }
    setState({ loading: true, error: null });
    try {
      await apiClient.createTodo(validation.value);
    } catch (err) {
      setState({ loading: false, error: toDisplayError(err) });
      return { ok: false };
    }
    return load(state.filter);
  }

  /**
   * UC-003：編輯標題。同樣先驗證再送出；成功後整份重新取清單。
   * @param {string} id
   * @param {string} rawTitle
   */
  async function updateTitle(id, rawTitle) {
    const validation = validateTitle(rawTitle);
    if (!validation.ok) {
      setState({ error: { kind: "validation", code: "E_VALIDATION", message: validation.message } });
      return { ok: false };
    }
    setState({ loading: true, error: null });
    try {
      await apiClient.updateTodo(id, { title: validation.value });
    } catch (err) {
      setState({ loading: false, error: toDisplayError(err) });
      return { ok: false };
    }
    return load(state.filter);
  }

  /**
   * UC-005：設定完成狀態的「目標值」（非 toggle，O-002）。呼叫端須傳入使用者想要的最終值。
   * @param {string} id
   * @param {boolean} isCompleted
   */
  async function setCompleted(id, isCompleted) {
    setState({ loading: true, error: null });
    try {
      await apiClient.updateTodo(id, { isCompleted });
    } catch (err) {
      setState({ loading: false, error: toDisplayError(err) });
      return { ok: false };
    }
    return load(state.filter);
  }

  /**
   * UC-004：刪除待辦（硬刪除，Q-003）。二次確認由呼叫端（todo-view）負責，本檔只執行刪除。
   * @param {string} id
   */
  async function remove(id) {
    setState({ loading: true, error: null });
    try {
      await apiClient.deleteTodo(id);
    } catch (err) {
      setState({ loading: false, error: toDisplayError(err) });
      return { ok: false };
    }
    return load(state.filter);
  }

  /** 供錯誤畫面的「重試」按鈕使用：以目前 filter 重新載入。 */
  function retry() {
    return load(state.filter);
  }

  return {
    getState,
    subscribe,
    actions: { load, setFilter, add, updateTitle, setCompleted, remove, retry }
  };
}

/** 供 todo-view.js 直接使用的預設單例（以真實 api-client 建立）。 */
export const todoStore = createTodoStore();
