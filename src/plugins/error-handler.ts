/**
 * src/plugins/error-handler.ts（BE-03）
 *
 * 統一錯誤處理器：src/app.ts 的 `[ANCHOR:error-handler]`，順序上是全站
 * 第一個註冊者（硬前提 8、SD §8.1），確保任何路由／hook 拋出的例外都被
 * 同一套邏輯接住，轉成 docs/specs/04_API規格.yaml components.schemas.Error
 * 的形狀（`{ code, message, details?, requestId }`）。同時以
 * `setNotFoundHandler` 讓未知路徑回同一結構（WBS §1.2 背景與限制）。
 *
 * 設計筆記（假設與決策，詳見交接檔「我做的假設與決策」）：
 * 本檔以 `registerErrorHandler(app)` 直接呼叫（而非 `app.register(...)`）
 * 掛上 `setErrorHandler`／`setNotFoundHandler`。原因：Fastify 的封裝機制
 * 會讓透過 `app.register()` 設定的 `setErrorHandler` 只對「該外掛自己的
 * 子情境」生效，之後才用 `app.register()` 註冊的手足外掛（WI-05 的
 * auth／static、WI-06 的 routes）不會繼承到，等同錯誤處理器形同虛設。
 * 官方作法是用 `fastify-plugin` 打破封裝，但那是本卡新增的相依，須先過
 * dev-tl（硬前提 7、任務卡「dev-tl 注意事項」③）。改成直接對 `app`
 * （根實例）呼叫 `setErrorHandler`／`setNotFoundHandler`，不經過
 * `app.register()` 的子情境，即可讓它對整棵樹全域生效，且不需要新套件。
 *
 * pino 的 `redact`（BR-016，避免 Authorization 標頭落日誌）已在
 * `src/app.ts` 的 Fastify 建構參數內設定（只能在建構時指定，見該檔第
 * 22~30 行），本檔不必再設。
 */
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { AppError, buildErrorBody, type ErrorCode, type ErrorDetails } from "../schemas/error-schema.js";

/**
 * 5xx 的固定字面值（BR-026、NFR-002②）。任何情況下都不得替換為實際例外
 * 訊息——這是本檔（而非 error-schema.ts）的職責：error-schema.ts 只定義
 * 契約「形狀」，本檔負責「強制執行」500 一律回這個字面值，故常數留在此處，
 * 供 dev-tl 逐字核對（WBS §1.2 驗收：`grep -n "Internal Server Error"
 * src/plugins/error-handler.ts`）。
 */
export const INTERNAL_ERROR_MESSAGE = "Internal Server Error";

/** HTTP 狀態碼 → 錯誤碼的一般化對照（SD §6.1）。用於非 AppError 的例外。 */
const STATUS_TO_CODE: Readonly<Partial<Record<number, ErrorCode>>> = {
  400: "E_VALIDATION",
  401: "E_UNAUTHORIZED",
  404: "E_NOT_FOUND",
  409: "E_EMAIL_TAKEN"
};

/**
 * `FastifyError.validation`（Fastify 官方型別 `FastifySchemaValidationError[]`，
 * 底層為 ajv v8 的 ErrorObject）在 schema 驗證失敗時由 Fastify 自動附加。
 */
function isValidationError(
  error: FastifyError
): error is FastifyError & { validation: NonNullable<FastifyError["validation"]> } {
  return Array.isArray(error.validation);
}

/** 從第一條違規推導 `{ field, rule }`，不回射使用者輸入原文（04_API規格.yaml Error.details）。 */
function detailsFromValidation(
  validation: NonNullable<FastifyError["validation"]>
): ErrorDetails | undefined {
  const first = validation[0];
  if (first === undefined) {
    return undefined;
  }
  const missingProperty = first.params["missingProperty"];
  const field =
    first.instancePath.length > 0
      ? first.instancePath.replace(/^\//, "")
      : typeof missingProperty === "string"
        ? missingProperty
        : "(root)";
  return { field, rule: first.keyword };
}

/** 未知／非 AppError 例外的狀態碼 → 錯誤碼；4xx 之外一律視為 E_INTERNAL（防禦性預設）。 */
function resolveCode(statusCode: number): ErrorCode {
  if (statusCode < 400 || statusCode >= 500) {
    return "E_INTERNAL";
  }
  return STATUS_TO_CODE[statusCode] ?? "E_VALIDATION";
}

function toStatusCode(error: FastifyError): number {
  return typeof error.statusCode === "number" ? error.statusCode : 500;
}

/**
 * 全域錯誤處理器。分三種來源，逐一判斷：
 * 1. `AppError`（業務／認證層主動丟出，已知語意）。
 * 2. Fastify／ajv 的 schema 驗證錯誤（`error.validation` 陣列）。
 * 3. 其他未預期例外（含未捕捉的第三方套件錯誤）——一律視為 500，
 *    完整訊息與堆疊只進日誌，回應永遠是固定字面值（BR-026、NFR-002②）。
 */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof AppError) {
    const message = error.code === "E_INTERNAL" ? INTERNAL_ERROR_MESSAGE : error.message;
    logByStatus(request, error.statusCode, error, message);
    reply.code(error.statusCode).send(buildErrorBody(error.code, message, request.id, error.details));
    return;
  }

  if (isValidationError(error)) {
    const details = detailsFromValidation(error.validation);
    logByStatus(request, 400, error, error.message);
    reply.code(400).send(buildErrorBody("E_VALIDATION", error.message, request.id, details));
    return;
  }

  const statusCode = toStatusCode(error);
  const code = resolveCode(statusCode);

  if (code === "E_INTERNAL") {
    logByStatus(request, 500, error, error.message);
    reply.code(500).send(buildErrorBody("E_INTERNAL", INTERNAL_ERROR_MESSAGE, request.id));
    return;
  }

  logByStatus(request, statusCode, error, error.message);
  reply.code(statusCode).send(buildErrorBody(code, error.message, request.id));
}

/** 未知路徑一律回統一結構（WBS §1.2：「同時設定 setNotFoundHandler」）。 */
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): void {
  const message = "Route not found";
  request.log.warn({ statusCode: 404 }, message);
  reply.code(404).send(buildErrorBody("E_NOT_FOUND", message, request.id));
}

/** SD §6.5：5xx 以 error 等級記錄（含堆疊，只進日誌），4xx 以 warn；日誌自動含 reqId（= request.id）。 */
function logByStatus(request: FastifyRequest, statusCode: number, error: Error, message: string): void {
  if (statusCode >= 500) {
    request.log.error({ err: error }, message);
  } else {
    request.log.warn({ err: error }, message);
  }
}

/**
 * 於 `src/app.ts` 的 `[ANCHOR:error-handler]` 直接呼叫（不透過
 * `app.register()`，理由見檔頭「設計筆記」），掛上全域錯誤處理器與
 * 404 處理器。呼叫時機必須在其他路由／外掛註冊之前（硬前提 8）。
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
}

export default registerErrorHandler;
