// src/plugins/basic-auth.ts（BE-02）
//
// 全站 Basic Auth：一個 onRequest hook 掛在根實例，涵蓋全部路由
// （SD §6.2、ADR-0004 議題一選 A）。
//
// 唯一豁免路徑是 GET／HEAD /health（BR-017、O-005、WBS §1.5；CR S-2
// 補：豁免限定方法，POST /health 等其他方法仍須認證）：
//   - 比對對象是剝除查詢字串與 hash 後的原始字元序列，不是 req.url
//     （req.url 含查詢字串，若直接比對會讓 /health?cb=1 被誤判為 401，
//     NFR-003 監測假失敗），也**不是** `new URL().pathname`（CR B-1：
//     WHATWG URL 解析器會正規化點節段，讓 /foo/../health 等變體繞過認證）。
//   - 比對方式是對請求原文做完全相等，不接受前綴、不接受萬用字元、不用
//     正則、不做任何路徑正規化（避免 /healthz-secret 或帶路徑穿越片段
//     的請求意外落入豁免）。
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

// 剝除查詢字串與 hash，只留原始字元序列（CR B-1：不得使用 `new URL().pathname`
// —— WHATWG URL 解析器會先把 `%2e` 解碼為 `.` 再摺疊 `..`／`.` 點節段，
// 使 `/foo/../health`、`/.%2e/health`、`/%2e%2e/health`、
// `/assets/%2e%2e/%2e%2e/health` 的 pathname 都等於 `/health`，讓未帶憑證
// 的請求繞過整個認證 hook。改成只用字串切割剝除 `?`／`#`，完全不做路徑
// 正規化，比對的是請求原文而非正規化後的結果）。
function stripQueryAndHash(rawUrl: string): string {
  const queryIndex = rawUrl.indexOf("?");
  const hashIndex = rawUrl.indexOf("#");
  let end = rawUrl.length;
  if (queryIndex >= 0) {
    end = Math.min(end, queryIndex);
  }
  if (hashIndex >= 0) {
    end = Math.min(end, hashIndex);
  }
  return rawUrl.slice(0, end);
}

// 供本檔與測試共用：判斷該請求是否命中唯一豁免路徑。
// CR S-2：豁免只適用 GET／HEAD（SD §6.2 未保護路徑清單只列 `GET /health`）；
// 其他方法（例如 POST /health）一律仍須認證，否則未認證者可藉此探測路由
// 是否存在。
export function isExemptPath(rawUrl: string, method: string): boolean {
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }
  return stripQueryAndHash(rawUrl) === HEALTH_PATHNAME;
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
    if (isExemptPath(request.url, request.method)) {
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
