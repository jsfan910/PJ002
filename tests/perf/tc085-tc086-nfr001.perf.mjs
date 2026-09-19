/**
 * tests/perf/tc085-tc086-nfr001.perf.mjs
 *
 * T-0021（qa-at）：TC-085／TC-086（NFR-001）。
 * TC-085：清單查詢 API 的 P95 < 500ms（10 併發，先暖身 10 秒，正式取樣 60 秒）。
 * TC-086：建立／更新／刪除 API 的 P95 < 800ms（同一組併發與暖身規則）。
 *
 * 執行：`node tests/perf/tc085-tc086-nfr001.perf.mjs`
 * 環境變數：`BASE_URL`（預設 http://localhost:8080）、
 *           `PERF_DURATION_MS`（正式取樣時長，預設 60000；CI 可縮短）、
 *           `PERF_WARMUP_MS`（暖身時長，預設 10000，門檻規定不可省略）。
 */
import { runLoad, summarize } from "./lib/load-runner.mjs";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
const USER = process.env.STAGING_BASIC_AUTH_USER ?? process.env.BASIC_AUTH_USER ?? "dev";
const PASSWORD = process.env.STAGING_BASIC_AUTH_PASSWORD ?? process.env.BASIC_AUTH_PASSWORD ?? "dev";
const AUTH_HEADER = `Basic ${Buffer.from(`${USER}:${PASSWORD}`, "utf-8").toString("base64")}`;
const CONCURRENCY = 10;
const WARMUP_MS = Number(process.env.PERF_WARMUP_MS ?? 10000);
const DURATION_MS = Number(process.env.PERF_DURATION_MS ?? 60000);

async function getList() {
  const response = await fetch(`${BASE_URL}/api/v1/todos`, { headers: { authorization: AUTH_HEADER } });
  await response.text();
  return { ok: response.status === 200, status: response.status };
}

async function createAndCleanup() {
  const createRes = await fetch(`${BASE_URL}/api/v1/todos`, {
    method: "POST",
    headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
    body: JSON.stringify({ title: `perf-${Date.now()}-${Math.random().toString(36).slice(2)}` })
  });
  const body = await createRes.json().catch(() => null);
  if (createRes.status === 201 && body?.id) {
    await fetch(`${BASE_URL}/api/v1/todos/${body.id}`, {
      method: "DELETE",
      headers: { authorization: AUTH_HEADER }
    }).catch(() => {});
  }
  return { ok: createRes.status === 201, status: createRes.status };
}

async function updateExisting(id) {
  const response = await fetch(`${BASE_URL}/api/v1/todos/${id}`, {
    method: "PATCH",
    headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
    body: JSON.stringify({ isCompleted: Math.random() > 0.5 })
  });
  await response.text();
  return { ok: response.status === 200, status: response.status };
}

async function deleteAndRecreate(idHolder) {
  const response = await fetch(`${BASE_URL}/api/v1/todos/${idHolder.id}`, {
    method: "DELETE",
    headers: { authorization: AUTH_HEADER }
  });
  await response.text();
  const ok = response.status === 204;
  const createRes = await fetch(`${BASE_URL}/api/v1/todos`, {
    method: "POST",
    headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
    body: JSON.stringify({ title: `perf-delete-${Date.now()}` })
  });
  const body = await createRes.json().catch(() => null);
  if (body?.id) idHolder.id = body.id;
  return { ok, status: response.status };
}

function printSummary(label, summary, thresholdMs) {
  console.log(`\n=== ${label} ===`);
  console.log(`count=${summary.count} errors 已排除於 ok 判定外`);
  console.log(`min=${summary.min.toFixed(1)}ms  mean=${summary.mean.toFixed(1)}ms`);
  console.log(`p50=${summary.p50.toFixed(1)}ms  p95=${summary.p95.toFixed(1)}ms  p99=${summary.p99.toFixed(1)}ms  max=${summary.max.toFixed(1)}ms`);
  const pass = summary.p95 < thresholdMs;
  console.log(`門檻：P95 < ${thresholdMs}ms → ${pass ? "PASS" : "FAIL"}`);
  return pass;
}

async function main() {
  console.log(`BASE_URL=${BASE_URL}  concurrency=${CONCURRENCY}  warmup=${WARMUP_MS}ms  duration=${DURATION_MS}ms`);

  // ---- TC-085：GET /api/v1/todos 暖身 + 正式 ----
  console.log("\n[TC-085] 暖身 10 秒（數據丟棄）...");
  await runLoad(getList, { concurrency: CONCURRENCY, durationMs: WARMUP_MS });
  console.log("[TC-085] 正式取樣...");
  const listResult = await runLoad(getList, { concurrency: CONCURRENCY, durationMs: DURATION_MS });
  const listSummary = summarize(listResult.durationsMs);
  const listPass = printSummary("TC-085 GET /api/v1/todos", listSummary, 500);

  // ---- TC-086：POST（建立＋清理）暖身 + 正式 ----
  console.log("\n[TC-086/POST] 暖身 10 秒（數據丟棄）...");
  await runLoad(createAndCleanup, { concurrency: CONCURRENCY, durationMs: WARMUP_MS });
  console.log("[TC-086/POST] 正式取樣...");
  const postResult = await runLoad(createAndCleanup, { concurrency: CONCURRENCY, durationMs: DURATION_MS });
  const postSummary = summarize(postResult.durationsMs);
  const postPass = printSummary("TC-086 POST /api/v1/todos", postSummary, 800);

  // ---- TC-086：PATCH（對固定一批既有資料反覆更新）----
  const seedIds = [];
  for (let i = 0; i < CONCURRENCY; i += 1) {
    const res = await fetch(`${BASE_URL}/api/v1/todos`, {
      method: "POST",
      headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
      body: JSON.stringify({ title: `perf-patch-seed-${i}` })
    });
    const body = await res.json();
    seedIds.push(body.id);
  }
  let seedIndex = 0;
  async function patchRotate() {
    const id = seedIds[seedIndex % seedIds.length];
    seedIndex += 1;
    return updateExisting(id);
  }
  console.log("\n[TC-086/PATCH] 暖身 10 秒（數據丟棄）...");
  await runLoad(patchRotate, { concurrency: CONCURRENCY, durationMs: WARMUP_MS });
  console.log("[TC-086/PATCH] 正式取樣...");
  const patchResult = await runLoad(patchRotate, { concurrency: CONCURRENCY, durationMs: DURATION_MS });
  const patchSummary = summarize(patchResult.durationsMs);
  const patchPass = printSummary("TC-086 PATCH /api/v1/todos/{id}", patchSummary, 800);

  // ---- TC-086：DELETE（刪除後立即補建，維持池子大小固定）----
  const deleteHolders = seedIds.map((id) => ({ id }));
  let deleteIndex = 0;
  async function deleteRotate() {
    const holder = deleteHolders[deleteIndex % deleteHolders.length];
    deleteIndex += 1;
    return deleteAndRecreate(holder);
  }
  console.log("\n[TC-086/DELETE] 暖身 10 秒（數據丟棄）...");
  await runLoad(deleteRotate, { concurrency: CONCURRENCY, durationMs: WARMUP_MS });
  console.log("[TC-086/DELETE] 正式取樣...");
  const deleteResult = await runLoad(deleteRotate, { concurrency: CONCURRENCY, durationMs: DURATION_MS });
  const deleteSummary = summarize(deleteResult.durationsMs);
  const deletePass = printSummary("TC-086 DELETE /api/v1/todos/{id}", deleteSummary, 800);

  // 清理 TC-086 遺留的 seed 資料
  for (const holder of deleteHolders) {
    await fetch(`${BASE_URL}/api/v1/todos/${holder.id}`, {
      method: "DELETE",
      headers: { authorization: AUTH_HEADER }
    }).catch(() => {});
  }

  const allPass = listPass && postPass && patchPass && deletePass;
  console.log(`\n=== 總結 ===\nTC-085 ${listPass ? "PASS" : "FAIL"}  TC-086(POST) ${postPass ? "PASS" : "FAIL"}  TC-086(PATCH) ${patchPass ? "PASS" : "FAIL"}  TC-086(DELETE) ${deletePass ? "PASS" : "FAIL"}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error("perf 腳本執行失敗：", error);
  process.exit(2);
});
