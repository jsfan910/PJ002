/**
 * tests/integration/todos-api.test.ts
 *
 * `/api/v1/todos` 五個端點（BE-04／BE-05，WBS §1.6）的整合測試，對本機
 * `docker compose up -d db` 起的真實 Postgres 實跑。沿用
 * `tests/integration/auth-basic.test.ts`／`health.test.ts` 的既有慣例：
 * 匯入 `../../dist/...`（已編譯產物），跑本測試前必須先 `npm run build`；
 * 環境變數以 `??=` 給預設值，不依賴外部 `.env`。
 *
 * **每一個 `app.inject()` 呼叫都帶 `authorization` 標頭**（T-0015 交接檔
 * 「下一步建議」1 的交辦；憑證由環境變數組出 Base64，不寫任何字面值），
 * 因為全站 Basic Auth（WI-05）已生效，未帶憑證的請求一律先被擋成 401，
 * 不會進到本檔要測的業務邏輯。
 *
 * 覆蓋重點（WBS §1.6 acceptance「五個端點的狀態碼、schema、錯誤碼與
 * 04_API規格.yaml 逐項一致」）：
 * - `GET /api/v1/todos`：狀態篩選（all／active／completed）在後端做
 *   （O-003）、排序新到舊（BR-005）、非法 `status` 值回 400。
 * - `POST /api/v1/todos`：201、`isCompleted` 恆為 `false`（BR-006）、
 *   空白標題 400、標題過長 400（而非 500）。
 * - `GET /{id}`：200／404；**UUID 格式不合法回 400**（見下方「規格衝突
 *   說明」），格式合法但查無資料回 404（SD §5 第 6 點，分界寫死）。
 * - `PATCH /{id}`：設定目標狀態（O-002，冪等，非 toggle）、body 無任何
 *   欄位回 400、夾帶 `id`／`createdAt` 被忽略、404。
 * - `DELETE /{id}`：204 無本文、404、不得因此建立新資料。
 * - `updatedAt` 不進回應契約（O-008）。
 *
 * **規格衝突說明（已記錄於本卡交接檔「我做的假設與決策」，非本檔職責
 * 自行決定，僅在此註記測試依據哪一版）**：本卡開工提示詞中出現一行
 * 「UUID 格式錯誤回 404（不洩漏）」，與 `docs/specs/10_開發計畫_WBS.md`
 * §1.6（`curl .../not-a-uuid # 400`）、`docs/specs/04_API規格.yaml`
 * （`TodoId` 參數說明「非 UUID 格式回 400」）、
 * `docs/specs/02_系統分析書_SA.md`／`03_系統設計書_SD.md` §5 第 6 點
 * （「分界寫死」：格式錯 400、格式對但查無資料 404）三份凍結規格文件
 * 及任務卡本身的可執行驗收指令一致地相反。本檔以三份規格文件與任務卡
 * 驗收指令為準（格式不合法 → 400），因為它們是有明確依據且可執行斷言
 * 的「合約」，提示詞中的單行敘述應為手誤。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../../dist/app.js";
import { loadConfig } from "../../dist/config.js";

process.env.NODE_ENV ??= "development";
process.env.PORT ??= "8080";
process.env.DATABASE_URL ??= "postgres://dev:dev@localhost:5432/todo";
process.env.BASIC_AUTH_USER ??= "dev";
process.env.BASIC_AUTH_PASSWORD ??= "dev";
process.env.LOG_LEVEL ??= "silent";

const USER = process.env.BASIC_AUTH_USER;
const PASSWORD = process.env.BASIC_AUTH_PASSWORD;
const AUTH_HEADER = `Basic ${Buffer.from(`${USER}:${PASSWORD}`, "utf-8").toString("base64")}`;

function authHeaders(): { authorization: string } {
  return { authorization: AUTH_HEADER };
}

function buildTestApp() {
  return buildApp(loadConfig());
}

interface TodoBody {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
}

const NON_EXISTENT_ID = "00000000-0000-4000-8000-000000000000";

// ---------------------------------------------------------------------------
// POST /api/v1/todos
// ---------------------------------------------------------------------------

test("POST /api/v1/todos：成功建立回 201，isCompleted 恆為 false（BR-006），不含 updatedAt（O-008）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "整合測試：買牛奶" }
  });

  assert.equal(response.statusCode, 201);
  const body = response.json() as TodoBody;
  assert.equal(body.title, "整合測試：買牛奶");
  assert.equal(body.isCompleted, false);
  assert.match(body.id, /^[0-9a-f-]{36}$/i);
  assert.equal(typeof body.createdAt, "string");
  assert.match(body.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.equal(response.payload.includes("updatedAt"), false);
  assert.deepEqual(Object.keys(body).sort(), ["createdAt", "id", "isCompleted", "title"]);

  await app.inject({ method: "DELETE", url: `/api/v1/todos/${body.id}`, headers: authHeaders() });
  await app.close();
});

test("POST /api/v1/todos：全空白標題回 400 E_VALIDATION（trim 早於長度檢查，schema 的 minLength 擋不掉）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "   " }
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.code, "E_VALIDATION");
  assert.equal(typeof body.requestId, "string");

  await app.close();
});

test("POST /api/v1/todos：201 字元標題回 400 而非 500（R-07）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "a".repeat(201) }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "E_VALIDATION");

  await app.close();
});

test("POST /api/v1/todos：缺 title 回 400（schema required）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: {}
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "E_VALIDATION");

  await app.close();
});

test("POST /api/v1/todos：title 送數字回 400（CR S-1：關閉 ajv coerceTypes，不得脅迫成字串後放行）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: 123 }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "E_VALIDATION");

  await app.close();
});

test("POST /api/v1/todos：夾帶 id／createdAt 一律忽略，由伺服器產生（BR-003、BR-012）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: {
      title: "整合測試：忽略夾帶欄位",
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: "2000-01-01T00:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 201);
  const body = response.json() as TodoBody;
  assert.notEqual(body.id, "11111111-1111-4111-8111-111111111111");
  assert.notEqual(body.createdAt, "2000-01-01T00:00:00.000Z");

  await app.inject({ method: "DELETE", url: `/api/v1/todos/${body.id}`, headers: authHeaders() });
  await app.close();
});

// ---------------------------------------------------------------------------
// GET /api/v1/todos（清單、篩選、排序）
// ---------------------------------------------------------------------------

test("GET /api/v1/todos：新到舊排序（BR-005），且可依 status 篩選（O-003，後端做）", async () => {
  const app = buildTestApp();

  const older = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "整合測試：排序-較舊" }
  });
  const olderId = (older.json() as TodoBody).id;

  await new Promise((resolve) => setTimeout(resolve, 20));

  const newer = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "整合測試：排序-較新" }
  });
  const newerId = (newer.json() as TodoBody).id;

  await app.inject({
    method: "PATCH",
    url: `/api/v1/todos/${newerId}`,
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { isCompleted: true }
  });

  const listAll = await app.inject({ method: "GET", url: "/api/v1/todos", headers: authHeaders() });
  assert.equal(listAll.statusCode, 200);
  const allBody = listAll.json() as TodoBody[];
  const newerIndex = allBody.findIndex((todo) => todo.id === newerId);
  const olderIndex = allBody.findIndex((todo) => todo.id === olderId);
  assert.ok(newerIndex >= 0 && olderIndex >= 0, "兩筆新建立的待辦都應出現在清單中");
  assert.ok(newerIndex < olderIndex, "較新建立的待辦應排在較舊的前面（新到舊）");

  const listCompleted = await app.inject({
    method: "GET",
    url: "/api/v1/todos?status=completed",
    headers: authHeaders()
  });
  const completedIds = (listCompleted.json() as TodoBody[]).map((todo) => todo.id);
  assert.ok(completedIds.includes(newerId));
  assert.equal(completedIds.includes(olderId), false);

  const listActive = await app.inject({
    method: "GET",
    url: "/api/v1/todos?status=active",
    headers: authHeaders()
  });
  const activeIds = (listActive.json() as TodoBody[]).map((todo) => todo.id);
  assert.ok(activeIds.includes(olderId));
  assert.equal(activeIds.includes(newerId), false);

  await app.inject({ method: "DELETE", url: `/api/v1/todos/${olderId}`, headers: authHeaders() });
  await app.inject({ method: "DELETE", url: `/api/v1/todos/${newerId}`, headers: authHeaders() });
  await app.close();
});

test("GET /api/v1/todos?status=bogus：非三個合法值回 400 E_VALIDATION", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/todos?status=bogus",
    headers: authHeaders()
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "E_VALIDATION");

  await app.close();
});

// ---------------------------------------------------------------------------
// GET /api/v1/todos/{id}
// ---------------------------------------------------------------------------

test("GET /api/v1/todos/{id}：查得到回 200", async () => {
  const app = buildTestApp();

  const created = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "整合測試：查詢單筆" }
  });
  const id = (created.json() as TodoBody).id;

  const response = await app.inject({ method: "GET", url: `/api/v1/todos/${id}`, headers: authHeaders() });

  assert.equal(response.statusCode, 200);
  assert.equal((response.json() as TodoBody).id, id);

  await app.inject({ method: "DELETE", url: `/api/v1/todos/${id}`, headers: authHeaders() });
  await app.close();
});

test("GET /api/v1/todos/{id}：格式合法但查無資料回 404（BR-009）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/todos/${NON_EXISTENT_ID}`,
    headers: authHeaders()
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "E_NOT_FOUND");

  await app.close();
});

test("GET /api/v1/todos/{id}：非 UUID 格式回 400（見檔頭「規格衝突說明」）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/todos/not-a-uuid",
    headers: authHeaders()
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "E_VALIDATION");

  await app.close();
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/todos/{id}
// ---------------------------------------------------------------------------

test("PATCH /api/v1/todos/{id}：設定完成狀態為冪等（O-002），重送仍為同一結果", async () => {
  const app = buildTestApp();

  const created = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "整合測試：冪等" }
  });
  const id = (created.json() as TodoBody).id;

  const first = await app.inject({
    method: "PATCH",
    url: `/api/v1/todos/${id}`,
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { isCompleted: true }
  });
  const second = await app.inject({
    method: "PATCH",
    url: `/api/v1/todos/${id}`,
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { isCompleted: true }
  });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  const firstBody = first.json() as TodoBody;
  const secondBody = second.json() as TodoBody;
  assert.equal(firstBody.isCompleted, true);
  assert.equal(secondBody.isCompleted, true);
  assert.equal(firstBody.createdAt, secondBody.createdAt, "createdAt 永不改變（BR-003）");

  await app.inject({ method: "DELETE", url: `/api/v1/todos/${id}`, headers: authHeaders() });
  await app.close();
});

test("PATCH /api/v1/todos/{id}：只改標題，不動 createdAt 與 isCompleted（UC-003）", async () => {
  const app = buildTestApp();

  const created = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "整合測試：改標題-原始" }
  });
  const createdBody = created.json() as TodoBody;

  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/todos/${createdBody.id}`,
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "整合測試：改標題-新版" }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as TodoBody;
  assert.equal(body.title, "整合測試：改標題-新版");
  assert.equal(body.isCompleted, false);
  assert.equal(body.createdAt, createdBody.createdAt);

  await app.inject({ method: "DELETE", url: `/api/v1/todos/${createdBody.id}`, headers: authHeaders() });
  await app.close();
});

test("PATCH /api/v1/todos/{id}：空 body 回 400（至少一個可更新欄位，BR-012）", async () => {
  const app = buildTestApp();

  const created = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "整合測試：空 body" }
  });
  const id = (created.json() as TodoBody).id;

  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/todos/${id}`,
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: {}
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "E_VALIDATION");

  await app.inject({ method: "DELETE", url: `/api/v1/todos/${id}`, headers: authHeaders() });
  await app.close();
});

test("PATCH /api/v1/todos/{id}：夾帶 id／createdAt 被忽略，原值不變（BR-012）", async () => {
  const app = buildTestApp();

  const created = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "整合測試：夾帶忽略" }
  });
  const createdBody = created.json() as TodoBody;

  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/todos/${createdBody.id}`,
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: {
      isCompleted: true,
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: "2000-01-01T00:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as TodoBody;
  assert.equal(body.id, createdBody.id, "id 不因夾帶而改變");
  assert.equal(body.createdAt, createdBody.createdAt, "createdAt 不因夾帶而改變");
  assert.equal(body.isCompleted, true, "有效欄位 isCompleted 仍生效");

  await app.inject({ method: "DELETE", url: `/api/v1/todos/${createdBody.id}`, headers: authHeaders() });
  await app.close();
});

test("PATCH /api/v1/todos/{id}：isCompleted 送 null 回 400（CR S-1：關閉 ajv coerceTypes，不得脅迫成 false 後放行）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/todos/${NON_EXISTENT_ID}`,
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { isCompleted: null }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "E_VALIDATION");

  await app.close();
});

test("PATCH /api/v1/todos/{id}：查無資料回 404", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/todos/${NON_EXISTENT_ID}`,
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { isCompleted: true }
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "E_NOT_FOUND");

  await app.close();
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/todos/{id}
// ---------------------------------------------------------------------------

test("DELETE /api/v1/todos/{id}：成功回 204 無本文（BR-008、O-001）", async () => {
  const app = buildTestApp();

  const created = await app.inject({
    method: "POST",
    url: "/api/v1/todos",
    headers: { ...authHeaders(), "content-type": "application/json" },
    payload: { title: "整合測試：刪除" }
  });
  const id = (created.json() as TodoBody).id;

  const response = await app.inject({ method: "DELETE", url: `/api/v1/todos/${id}`, headers: authHeaders() });

  assert.equal(response.statusCode, 204);
  assert.equal(response.payload, "");

  const getAfterDelete = await app.inject({ method: "GET", url: `/api/v1/todos/${id}`, headers: authHeaders() });
  assert.equal(getAfterDelete.statusCode, 404);

  await app.close();
});

test("DELETE /api/v1/todos/{id}：查無資料回 404，且不得因此建立資料（BR-009）", async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: "DELETE",
    url: `/api/v1/todos/${NON_EXISTENT_ID}`,
    headers: authHeaders()
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "E_NOT_FOUND");

  const getAfter = await app.inject({
    method: "GET",
    url: `/api/v1/todos/${NON_EXISTENT_ID}`,
    headers: authHeaders()
  });
  assert.equal(getAfter.statusCode, 404, "不得因刪除失敗而建立出這筆資料");

  await app.close();
});

// ---------------------------------------------------------------------------
// 全站 Basic Auth 仍對本模組的路由生效（與 WI-05 的整合）
// ---------------------------------------------------------------------------

test("未帶憑證呼叫 /api/v1/todos 回 401，不回傳任何待辦資料", async () => {
  const app = buildTestApp();

  const response = await app.inject({ method: "GET", url: "/api/v1/todos" });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, "E_UNAUTHORIZED");

  await app.close();
});
