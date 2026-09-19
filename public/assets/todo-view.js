/**
 * public/assets/todo-view.js（FE-04 todo-view，WI-07／T-0017）
 *
 * 訂閱 todo-store 並整段重繪（SD §3.2）；同時擔任本卡唯一的「controller」角色，
 * 把 DOM 事件轉譯為 todo-store 的 action 呼叫：
 *   使用者事件 → 本檔（controller 部分） → todo-store → 本檔（view 部分，只讀，整段重繪）
 *
 * 規則（WBS §1.7 背景與限制）：
 *   - 本檔**不得**呼叫 api-client 或 `fetch`，只透過 `todoStore.actions.*` 異動狀態。
 *   - 一律以 `textContent`／`createElement` 寫入使用者輸入；全專案禁止動態拼接 HTML 字串
 *     寫入 DOM（BR-013，CR 判準見 SD §6.3：`public/` 下不得出現該危險寫法）。
 *   - `createdAt` 以 `Intl.DateTimeFormat` 轉換為瀏覽器本地時區的 `yyyy-mm-dd HH:mm`（BR-004）。
 *   - 清單以 `DocumentFragment` 組完整內容後單次插入（NFR-007），不做局部 DOM 補丁。
 *   - 刪除前以 `window.confirm` 二次確認（BR-008，Leader 裁決 Q-003）。
 *   - 完成狀態切換直接送使用者勾選後的「目標值」（checkbox.checked），不做反轉（O-002）。
 *   - 不改動 `public/index.html` 既有 11 個 `data-testid` 元素的結構；本檔只讀取它們、
 *     並把動態內容（清單項目、載入中／錯誤訊息文字、篩選按鈕的 `aria-pressed`）寫進去。
 *   - 版面不新增 CSS 檔案改動（本卡 outputs 不含 `styles.css`）：動態產生的元素以行內
 *     `style`（可引用既有 `:root` CSS 變數）達成 44×44 最小點擊區與不橫向捲動，
 *     並避免 `flex: n n <px>` 陷阱（T-0014 交接檔提醒：斷點換軸向時 px basis 會變成高度）。
 */

import { todoStore } from "./todo-store.js";

// ---- 既有骨架元素（public/index.html，11 個穩定 data-testid，不得改動其結構） ----
const addForm = document.querySelector('[data-testid="add-todo-form"]');
const addInput = document.querySelector('[data-testid="add-todo-input"]');
const filterButtons = Array.from(document.querySelectorAll('[data-filter-value]'));
const loadingIndicator = document.querySelector('[data-testid="loading-indicator"]');
const errorMessageEl = document.querySelector('[data-testid="error-message"]');
const todoListEl = document.querySelector('[data-testid="todo-list"]');

// 新增輸入框改由本檔的 JS 驗證（trim 後長度 1~200）接手空白／必填檢查，
// 統一走 error-message 區顯示訊息（原生 `required` 的瀏覽器提示與此區不一致）。
if (addInput) {
  addInput.required = false;
}

// 目前處於「編輯中」的待辦 id；純畫面狀態，不進 todo-store（store 只保存伺服器資料狀態）。
let editingId = null;

const BUTTON_STYLE =
  "min-width:44px;min-height:44px;padding:0 12px;border-radius:6px;border:1px solid var(--color-border);" +
  "background:var(--color-surface);color:var(--color-text);cursor:pointer;font-size:0.9rem;";
const DANGER_BUTTON_STYLE =
  "min-width:44px;min-height:44px;padding:0 12px;border-radius:6px;border:1px solid var(--color-error-text);" +
  "background:var(--color-error-bg);color:var(--color-error-text);cursor:pointer;font-size:0.9rem;";
const PRIMARY_BUTTON_STYLE =
  "min-width:44px;min-height:44px;padding:0 12px;border-radius:6px;border:none;" +
  "background:var(--color-primary);color:var(--color-primary-text);cursor:pointer;font-size:0.9rem;";

const createdAtFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

/**
 * BR-004：以瀏覽器本地時區把 ISO 8601（UTC）字串轉為 `yyyy-mm-dd HH:mm`，不做相對時間。
 * 用 `formatToParts` 自行組字串，避免依賴特定 locale 的字元順序。
 * @param {string} isoString
 */
function formatCreatedAt(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = createdAtFormatter.formatToParts(date);
  const byType = {};
  for (const part of parts) {
    byType[part.type] = part.value;
  }
  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute}`;
}

function createButton(text, testid, style) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.dataset.testid = testid;
  button.style.cssText = style;
  return button;
}

/** 建立單筆待辦在「顯示模式」下的 `<li>` 內容。 */
function renderDisplayItem(li, todo) {
  const toggleLabel = document.createElement("label");
  toggleLabel.style.cssText =
    "display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;" +
    "flex:0 0 auto;cursor:pointer;";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(todo.isCompleted);
  checkbox.dataset.testid = "todo-item-toggle";
  checkbox.setAttribute("aria-label", "切換完成狀態");
  checkbox.addEventListener("change", () => {
    // O-002：直接送出使用者勾選後的目標值，不是取反目前值。
    todoStore.actions.setCompleted(todo.id, checkbox.checked);
  });
  toggleLabel.appendChild(checkbox);

  const body = document.createElement("div");
  body.style.cssText = "flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;";

  const titleEl = document.createElement("span");
  titleEl.dataset.testid = "todo-item-title";
  titleEl.textContent = todo.title;
  titleEl.style.cssText = todo.isCompleted
    ? "overflow-wrap:break-word;text-decoration:line-through;opacity:0.6;"
    : "overflow-wrap:break-word;";

  const createdAtEl = document.createElement("span");
  createdAtEl.dataset.testid = "todo-item-created-at";
  createdAtEl.textContent = formatCreatedAt(todo.createdAt);
  createdAtEl.style.cssText = "font-size:0.8rem;opacity:0.7;";

  body.append(titleEl, createdAtEl);

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;flex:0 0 auto;flex-wrap:wrap;";

  const editButton = createButton("編輯", "todo-item-edit", BUTTON_STYLE);
  editButton.addEventListener("click", () => {
    editingId = todo.id;
    render();
  });

  const deleteButton = createButton("刪除", "todo-item-delete", DANGER_BUTTON_STYLE);
  deleteButton.addEventListener("click", () => {
    // BR-008、Q-003：刪除前二次確認。
    const confirmed = window.confirm(`確定要刪除「${todo.title}」嗎？此操作無法復原。`);
    if (confirmed) {
      todoStore.actions.remove(todo.id);
    }
  });

  actions.append(editButton, deleteButton);
  li.append(toggleLabel, body, actions);
}

/** 建立單筆待辦在「編輯模式」下的 `<li>` 內容（UC-003）。 */
function renderEditingItem(li, todo) {
  const form = document.createElement("form");
  form.dataset.testid = "todo-item-edit-form";
  form.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;width:100%;align-items:center;";

  const input = document.createElement("input");
  input.type = "text";
  input.value = todo.title;
  input.maxLength = 200;
  input.dataset.testid = "todo-item-edit-input";
  input.setAttribute("aria-label", "編輯待辦標題");
  input.style.cssText =
    "flex:1 1 auto;min-width:160px;height:44px;padding:0 8px;border:1px solid var(--color-border);" +
    "border-radius:6px;font-size:1rem;";

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "儲存";
  saveButton.dataset.testid = "todo-item-edit-save";
  saveButton.style.cssText = PRIMARY_BUTTON_STYLE;

  const cancelButton = createButton("取消", "todo-item-edit-cancel", BUTTON_STYLE);
  cancelButton.addEventListener("click", () => {
    // AC-003-3：取消維持原標題並離開編輯狀態。
    editingId = null;
    render();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextTitle = input.value;
    // 先離開編輯狀態再送出，避免等待網路時畫面卡在編輯表單；
    // 若驗證或伺服器回錯誤，store 會設定 error，原標題不受影響（AC-003-2）。
    editingId = null;
    render();
    todoStore.actions.updateTitle(todo.id, nextTitle);
  });

  form.append(input, saveButton, cancelButton);
  li.append(form);
}

function createTodoItemElement(todo) {
  const li = document.createElement("li");
  li.dataset.testid = "todo-item";
  li.dataset.todoId = todo.id;
  li.style.flexWrap = "wrap";

  if (todo.id === editingId) {
    renderEditingItem(li, todo);
  } else {
    renderDisplayItem(li, todo);
  }
  return li;
}

function emptyStateMessage(filter) {
  if (filter === "all") {
    return "目前沒有任何待辦事項，新增一筆開始吧。";
  }
  return "此篩選下沒有待辦事項。";
}

/** BR-028／NFR-007：以 DocumentFragment 組完整清單後單次插入，整段替換（BR-011）。 */
function renderList(todos, filter) {
  const fragment = document.createDocumentFragment();

  if (!todos || todos.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.dataset.testid = "empty-state";
    emptyItem.textContent = emptyStateMessage(filter);
    emptyItem.style.cssText = "justify-content:center;color:var(--color-text);opacity:0.7;";
    fragment.appendChild(emptyItem);
  } else {
    for (const todo of todos) {
      fragment.appendChild(createTodoItemElement(todo));
    }
  }

  todoListEl.textContent = "";
  todoListEl.appendChild(fragment);
}

function renderLoading(loading) {
  loadingIndicator.hidden = !loading;
}

function renderError(error) {
  if (!error) {
    errorMessageEl.hidden = true;
    errorMessageEl.textContent = "";
    return;
  }
  errorMessageEl.hidden = false;
  errorMessageEl.textContent = error.message;

  const retryButton = createButton("重試", "error-retry-button", BUTTON_STYLE);
  retryButton.style.marginLeft = "8px";
  retryButton.addEventListener("click", () => {
    todoStore.actions.retry();
  });
  errorMessageEl.appendChild(retryButton);
}

function renderFilterButtons(filter) {
  for (const button of filterButtons) {
    const isActive = button.dataset.filterValue === filter;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
}

function render() {
  const state = todoStore.getState();
  renderLoading(state.loading);
  renderError(state.error);
  renderList(state.todos, state.filter);
  renderFilterButtons(state.filter);
}

// ---- 事件綁定（controller 職責：使用者事件 → todo-store action） ----

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = addInput.value;
  todoStore.actions.add(title).then((result) => {
    if (result && result.ok) {
      // AC-001-5：新增成功後清空輸入框，可直接輸入下一筆。
      addInput.value = "";
      addInput.focus();
    }
  });
});

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    todoStore.actions.setFilter(button.dataset.filterValue);
  });
}

// ---- 啟動：訂閱 store、先畫出初始（空）畫面，再觸發第一次載入 ----
todoStore.subscribe(render);
render();
todoStore.actions.load();
