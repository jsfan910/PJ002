/**
 * tests/unit/error-handler.test.ts
 *
 * 統一錯誤處理器（BE-03）的純邏輯單元測試：不建 Fastify app，直接呼叫
 * errorHandler／notFoundHandler，用最小的假 request/reply 物件觀察輸出。
 *
 * 匯入路徑指向 `../../dist/...`（已編譯產物），而非 `src/`：
 * `src/plugins/error-handler.ts` 內部以 `.js` 匯入規格參照
 * `../schemas/error-schema.js`（NodeNext 規則要求），Node 原生的 TypeScript
 * 型別剝除不會把這個匯入規格回頭解析成同名 `.ts` 檔（同 README「已知平台
 * 限制」對整合測試的說明；此限制不因「測試檔自己改用明確 `.ts` 副檔名匯入
 * 進入點」而消失，因為卡住的是入口模組*自己內部*的相對匯入，不是測試檔
 * 如何匯入入口模組——實測：以 `.ts` 匯入 error-handler.ts 仍會在載入其內部
 * `error-schema.js` 時丟出 `ERR_MODULE_NOT_FOUND`）。因此本測試依賴
 * 「先 `npm run build` 再跑測試」的順序，與整合測試一致。
 *
 * **需要 Leader／dev-tl 裁決**：`.github/workflows/ci.yml` 的 `unit` job
 * 目前只 `needs: lint`，未在 `npm run test:unit` 前執行 `npm run build`
 * （與 `integration` job 不同），會導致本測試在 CI 上因 `dist/` 不存在而
 * 失敗。詳見交接檔「需要 Leader 裁決的事」。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { INTERNAL_ERROR_MESSAGE, errorHandler, notFoundHandler } from "../../dist/plugins/error-handler.js";
import { AppError } from "../../dist/schemas/error-schema.js";

interface CapturedReply {
  statusCode?: number;
  body?: unknown;
}

interface FakeRequest {
  id: string;
  log: {
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  warnCalls: unknown[][];
  errorCalls: unknown[][];
}

function buildFakeRequest(id = "req-test-1"): FakeRequest {
  const warnCalls: unknown[][] = [];
  const errorCalls: unknown[][] = [];
  return {
    id,
    warnCalls,
    errorCalls,
    log: {
      warn: (...args: unknown[]) => warnCalls.push(args),
      error: (...args: unknown[]) => errorCalls.push(args)
    }
  };
}

function buildFakeReply(): { reply: { code: (c: number) => typeof reply; send: (b: unknown) => void }; captured: CapturedReply } {
  const captured: CapturedReply = {};
  const reply = {
    code(statusCode: number) {
      captured.statusCode = statusCode;
      return reply;
    },
    send(body: unknown) {
      captured.body = body;
    }
  };
  return { reply, captured };
}

test("AppError(E_VALIDATION) 轉為 400，帶 details，requestId 等於 request.id", () => {
  const request = buildFakeRequest("req-aaa");
  const { reply, captured } = buildFakeReply();
  const error = new AppError("E_VALIDATION", "title must not be empty after trimming", {
    field: "title",
    rule: "minLength"
  });

  errorHandler(error as never, request as never, reply as never);

  assert.equal(captured.statusCode, 400);
  assert.deepEqual(captured.body, {
    code: "E_VALIDATION",
    message: "title must not be empty after trimming",
    details: { field: "title", rule: "minLength" },
    requestId: "req-aaa"
  });
  assert.equal(request.warnCalls.length, 1);
  assert.equal(request.errorCalls.length, 0);
});

test("AppError(E_NOT_FOUND) 轉為 404，無 details", () => {
  const request = buildFakeRequest("req-bbb");
  const { reply, captured } = buildFakeReply();
  const error = new AppError("E_NOT_FOUND", "Todo not found");

  errorHandler(error as never, request as never, reply as never);

  assert.equal(captured.statusCode, 404);
  assert.deepEqual(captured.body, {
    code: "E_NOT_FOUND",
    message: "Todo not found",
    requestId: "req-bbb"
  });
});

test("AppError(E_INTERNAL) 一律用固定訊息，即使建構時傳了自訂訊息與 details", () => {
  const request = buildFakeRequest("req-ccc");
  const { reply, captured } = buildFakeReply();
  const error = new AppError("E_INTERNAL", "DATABASE_URL=postgres://leaked", {
    field: "sql",
    rule: "should-not-appear"
  });

  errorHandler(error as never, request as never, reply as never);

  assert.equal(captured.statusCode, 500);
  assert.deepEqual(captured.body, {
    code: "E_INTERNAL",
    message: INTERNAL_ERROR_MESSAGE,
    requestId: "req-ccc"
  });
  assert.equal(JSON.stringify(captured.body).includes("leaked"), false);
  assert.equal(request.errorCalls.length, 1);
});

test("Fastify schema 驗證錯誤（error.validation）轉為 400 E_VALIDATION，details 只含欄位與規則", () => {
  const request = buildFakeRequest("req-ddd");
  const { reply, captured } = buildFakeReply();
  const validationError = Object.assign(new Error("body/title must NOT have fewer than 1 characters"), {
    statusCode: 400,
    code: "FST_ERR_VALIDATION",
    validation: [{ instancePath: "/title", keyword: "minLength", params: { limit: 1 } }]
  });

  errorHandler(validationError as never, request as never, reply as never);

  assert.equal(captured.statusCode, 400);
  const body = captured.body as { code: string; details?: { field: string; rule: string } };
  assert.equal(body.code, "E_VALIDATION");
  assert.deepEqual(body.details, { field: "title", rule: "minLength" });
});

test("未預期例外一律回 500 E_INTERNAL，固定訊息，不洩漏例外訊息或堆疊", () => {
  const request = buildFakeRequest("req-eee");
  const { reply, captured } = buildFakeReply();
  const unexpected = new Error("connect ECONNREFUSED 127.0.0.1:5432 at pg pool");

  errorHandler(unexpected as never, request as never, reply as never);

  assert.equal(captured.statusCode, 500);
  assert.deepEqual(captured.body, {
    code: "E_INTERNAL",
    message: INTERNAL_ERROR_MESSAGE,
    requestId: "req-eee"
  });
  const serialized = JSON.stringify(captured.body);
  assert.equal(serialized.includes("ECONNREFUSED"), false);
  assert.equal(serialized.toLowerCase().includes("stack"), false);
  assert.equal(request.errorCalls.length, 1);
});

test("帶 statusCode 的一般錯誤（例如未來 basic-auth 丟出 401）依狀態碼對應到正確錯誤碼", () => {
  const request = buildFakeRequest("req-fff");
  const { reply, captured } = buildFakeReply();
  const unauthorized = Object.assign(new Error("Authentication required"), { statusCode: 401 });

  errorHandler(unauthorized as never, request as never, reply as never);

  assert.equal(captured.statusCode, 401);
  assert.deepEqual(captured.body, {
    code: "E_UNAUTHORIZED",
    message: "Authentication required",
    requestId: "req-fff"
  });
});

test("notFoundHandler：未知路徑回統一結構的 404，含 requestId，不含 details", () => {
  const request = buildFakeRequest("req-ggg");
  const { reply, captured } = buildFakeReply();

  notFoundHandler(request as never, reply as never);

  assert.equal(captured.statusCode, 404);
  assert.deepEqual(captured.body, {
    code: "E_NOT_FOUND",
    message: "Route not found",
    requestId: "req-ggg"
  });
});
