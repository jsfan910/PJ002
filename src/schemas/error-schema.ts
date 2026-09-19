/**
 * src/schemas/error-schema.ts（BE-03）
 *
 * 統一錯誤契約的型別與工具（SD §6.1、docs/specs/04_API規格.yaml
 * components.schemas.Error）。全站錯誤回應皆為同一個形狀：
 * `{ code, message, details?, requestId }`（additionalProperties: false）。
 *
 * - `details` 只可能出現在 4xx；5xx 一律不含 `details`。
 * - `E_INTERNAL`（5xx）的 `message` 恆為固定字面值（BR-026、NFR-002②），
 *   本檔與 error-handler.ts 共同強制這一點，不由呼叫端決定。
 * - `E_EMAIL_TAKEN`/409 為 P1（BR-024），本卡只預留常數與型別，
 *   不在任何 P0 流程中主動丟出（WBS §1.2 背景與限制）。
 */

/** 錯誤碼表（SD §6.1）。與 04_API規格.yaml Error.code 的 enum 逐字一致。 */
export type ErrorCode = "E_VALIDATION" | "E_UNAUTHORIZED" | "E_NOT_FOUND" | "E_EMAIL_TAKEN" | "E_INTERNAL";

/** 錯誤碼 → HTTP 狀態碼（SD §6.1 表格）。 */
export const ERROR_STATUS: Readonly<Record<ErrorCode, number>> = {
  E_VALIDATION: 400,
  E_UNAUTHORIZED: 401,
  E_NOT_FOUND: 404,
  E_EMAIL_TAKEN: 409,
  E_INTERNAL: 500
};

/**
 * `details` 只含欄位名稱與違反的規則，不回射使用者輸入原文
 * （04_API規格.yaml Error.details 說明；避免把注入字串原樣送回）。
 */
export type ErrorDetails = Record<string, string | number | boolean>;

/** 對應 04_API規格.yaml components.schemas.Error（逐欄一致）。 */
export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: ErrorDetails;
  requestId: string;
}

/**
 * 業務／認證層（未來 WI-05 全站 Basic Auth、WI-06 待辦 API 業務規則等）
 * 以丟出本類別的方式表達「已知的、有語意的」錯誤，由 error-handler.ts 的
 * 全域 handler 統一轉成契約物件——這是 BE-03「單點產生」錯誤回應的具體
 * 實作方式，避免各路由自行組裝 `{ code, message, ... }`。
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: ErrorDetails;

  constructor(code: ErrorCode, message: string, details?: ErrorDetails) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = ERROR_STATUS[code];
    // 5xx 一律不得帶 details（BR-026）；即使呼叫端誤傳也在此擋下，防禦性設計。
    this.details = code === "E_INTERNAL" ? undefined : details;
  }
}

/**
 * 組出符合契約的錯誤本文。`details` 為 undefined 或錯誤碼為 `E_INTERNAL`
 * 時不產生該欄位（呼應 OpenAPI `additionalProperties: false` 與「5xx 一律
 * 無 details」的規則），而不是寫入值為 `undefined` 的欄位。
 */
export function buildErrorBody(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: ErrorDetails
): ErrorBody {
  const body: ErrorBody = { code, message, requestId };
  if (details !== undefined && code !== "E_INTERNAL") {
    body.details = details;
  }
  return body;
}
