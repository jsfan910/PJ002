/**
 * tests/integration/qa/us010-deploy.qa.test.ts
 * T-0021（qa-at）：US-010 staging 部署，integration 層級 P0 TC。
 *
 * 現實條件（任務卡）：staging 尚未部署（使用者尚未提供 GCP／GitHub 設定）。
 * `STAGING_READY` 為 false 時，僅存在於 Cloud Run 平台或需要「觸發一次
 * 真實重新部署／回滾」的 TC（TC-079、TC-080、TC-084）一律 `t.skip()`，
 * 在 AT 報告記為「阻擋（環境未就緒）」而非不通過；其餘可在本機
 * docker compose 驗證的 TC（TC-082、TC-083）照常執行。TC-093（NFR-006）
 * 另立一檔（見 `us010-nfr006-persistence.qa.test.ts`）。
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

import { AUTH_HEADER, BASE_URL, STAGING_READY, http, waitForHealth } from "./lib/http-client.ts";

const exec = promisify(execFile);

test.before(async () => {
  await waitForHealth();
});

test("TC-079：HTTP 由平台自動 301 導向 HTTPS（Cloud Run 平台行為，本機無此層）", async (t) => {
  if (!STAGING_READY) {
    t.skip("阻擋（環境未就緒）：staging 尚未部署於 Cloud Run，本機 docker compose 無 TLS 終止層，無法驗證平台 301。$STAGING_BASE_URL 回填後改用 curl -sSI 對 http:// 版本重跑。");
    return;
  }
  const stagingHost = process.env.STAGING_BASE_URL!.replace(/^https:\/\//, "");
  const response = await fetch(`http://${stagingHost}/health`, { redirect: "manual" });
  assert.equal(response.status, 301);
  assert.match(String(response.headers.get("location")), /^https:\/\//);
});

test("TC-080：一次新的部署後既有資料仍存在（需觸發真實 staging 部署）", async (t) => {
  if (!STAGING_READY) {
    t.skip("阻擋（環境未就緒）：需觸發一次真實 staging 重新部署並等待 verify 階段，本機無等效動作（容器重啟不等同於一次部署）。");
    return;
  }
  t.skip("staging 已就緒，但觸發部署需人工核准 GitHub Actions run，留給 qa-lead／dev-ops 於 Gate 2 排程時執行並回填本測試（見 AT 報告「未自動化的 TC」）。");
});

test("TC-082：/health 不帶憑證回 200；/ 不帶憑證回 401（唯一未保護路徑）", async () => {
  const health = await fetch(`${BASE_URL}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });

  const root = await fetch(`${BASE_URL}/`);
  assert.equal(root.status, 401);
});

test("TC-083：全站 Basic Auth 涵蓋 API 與靜態資產；憑證未入倉庫", async () => {
  const noAuthApi = await http.get("/api/v1/todos", { auth: false });
  assert.equal(noAuthApi.status, 401);
  assert.equal(noAuthApi.headers.get("www-authenticate")?.startsWith("Basic"), true);
  assert.equal(noAuthApi.bodyText.toLowerCase().includes("todo"), false);

  const noAuthStatic = await fetch(`${BASE_URL}/assets/api-client.js`);
  assert.equal(noAuthStatic.status, 401);

  const wrongAuthHeader = `Basic ${Buffer.from("wrong:wrong", "utf-8").toString("base64")}`;
  const wrongAuth = await fetch(`${BASE_URL}/api/v1/todos`, { headers: { authorization: wrongAuthHeader } });
  assert.equal(wrongAuth.status, 401);

  const rightAuth = await fetch(`${BASE_URL}/api/v1/todos`, { headers: { authorization: AUTH_HEADER } });
  assert.equal(rightAuth.status, 200);

  // 掃描範圍限定於實際會被執行／部署的檔案（排除 docs／worklog 等純文件記錄，
  // 那些只是「討論憑證掃描」的歷史紀錄，不是可執行的憑證來源）。另外排除兩類
  // dev-tl 於 T-0018 審核交接檔（20260919-1133-T0018-r1-dev-tl.md §4）已裁定
  // 為「結構性假陽性」的樣式：(a) `--set-secrets` 的 Secret Manager 參照語法
  // （右側以 `:latest` 結尾，是 secret 名稱不是值）；(b) shell 變數展開
  // `="${...}"`（讀環境變數，不是字面值）。其餘任何命中都是真命中。
  const { stdout } = await exec("git", [
    "grep",
    "-nE",
    "BASIC_AUTH_(USER|PASSWORD)\\s*=\\s*\\S",
    "--",
    "src",
    "public",
    "tests",
    ".github/workflows",
    "infra",
    "scripts",
    "docker-compose.yml"
  ]).catch((error: { stdout?: string; code?: number }) => ({ stdout: error.stdout ?? "" }));
  const realHits = stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .filter((line) => !line.includes(":latest"))
    .filter((line) => !/=\s*"\$\{/.test(line));
  assert.deepEqual(realHits, [], `倉庫內疑似有 Basic Auth 憑證字面值：${realHits.join("\n")}`);
});

test("TC-084：Cloud Run revision 切流量回滾（需真實 staging 環境與回滾演練）", async (t) => {
  t.skip(
    STAGING_READY
      ? "staging 已就緒，但回滾演練需 dev-ops 依 06 §5.4 執行並回填演練紀錄（至少兩個 revision），非本卡可觸發，留給 qa-lead 追蹤。"
      : "阻擋（環境未就緒）：回滾演練是 Gate 2 前置條件，需已部署的 staging 服務與至少兩個 revision，尚未成立。"
  );
});
