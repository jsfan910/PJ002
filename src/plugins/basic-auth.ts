// src/plugins/basic-auth.ts（BE-02）
//
// 全站 Basic Auth：一個 onRequest hook 掛在根實例，涵蓋全部路由
// （SD §6.2、ADR-0004 議題一選 A）。
//
// 唯一豁免路徑是 GET /health（BR-017、O-005、WBS §1.5）：
//   - 比對對象是 pathname，不是 req.url（req.url 含查詢字串，
//     若直接比對會讓 /health?cb=1 被誤判為 401，NFR-003 監測假失敗）。
//   - 比對方式是完全相等，不接受前綴、不接受萬用字元、不用正則
//     （避免 /healthz-secret 或帶路徑穿越片段的請求意外落入豁免）。
//
// 帳密只讀自 config（BASIC_AUTH_USER／BASIC_AUTH_PASSWORD），比對使用
// crypto.timingSafeEqual 常數時間比較，避免時序側通道。認證失敗一律以
// AppError("E_UNAUTHORIZED", ...) 交給全域錯誤處理器（WI-02）序列化，
// 本檔不呼叫 setErrorHandler，也不自行組裝回應本文。
import { timingSafeEqual } from "node:crypto";

import fastifyBasicAuth from "@fastify/basic-auth";
import type { FastifyInstance } from "fastify";

import type { AppConfig } from "../config.js";
import { AppError } from "../schemas/error-schema.js";

const REALM = "staging";
const HEALTH_PATHNAME = "/health";

function toBuffer(value: string): Buffer {
  return Buffer.from(value, "utf-8");
}

// 常數時間比較兩個字串。長度不同時仍執行一次等長比較，避免以「長度不同就
// 早退」的方式在時序上洩漏長度資訊。
function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = toBuffer(actual);
  const expectedBuffer = toBuffer(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

// 剝除查詢字串與 hash，只留 pathname，供完全相等比對
// （WBS §1.5：豁免比對必須對 pathname 而非 req.url）。
function extractPathname(rawUrl: string): string {
  return new URL(rawUrl, "http://localhost").pathname;
}

// 供本檔與測試共用：判斷該請求是否命中唯一豁免路徑。
export function isExemptPath(rawUrl: string): boolean {
  return extractPathname(rawUrl) === HEALTH_PATHNAME;
}

// 於 src/app.ts 的 [ANCHOR:auth] 直接呼叫（不經過巢狀 app.register 建立
// 子情境，理由同 WI-02 的 error-handler：hook 必須掛在根實例，才能涵蓋
// 之後才註冊的 static（BE-09）與 routes（BE-04），否則封裝邊界會讓它們
// 繼承不到這個 hook，造成靜態檔或 API 不設防）。
export function registerBasicAuth(app: FastifyInstance, config: AppConfig): void {
  app.register(fastifyBasicAuth, {
    // 標頭一律由本檔統一組出（見下方 onRequest hook），不用外掛內建的
    // authenticate 選項——它會附加 charset 屬性，與 ADR-0004／04_API規格.yaml
    // 明列的 Basic realm="staging" 逐字不符。
    validate(username, password, _request, _reply, done) {
      const userOk = safeEqual(username, config.basicAuthUser);
      const passwordOk = safeEqual(password, config.basicAuthPassword);
      if (userOk && passwordOk) {
        done();
        return;
      }
      done(new AppError("E_UNAUTHORIZED", "Invalid username or password"));
    }
  });

  app.addHook("onRequest", (request, reply, done) => {
    if (isExemptPath(request.url)) {
      done();
      return;
    }
    app.basicAuth(request, reply, (err) => {
      if (err) {
        reply.header("WWW-Authenticate", `Basic realm="${REALM}"`);
      }
      done(err);
    });
  });
}

export default registerBasicAuth;
