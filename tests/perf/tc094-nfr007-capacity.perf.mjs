/**
 * tests/perf/tc094-nfr007-capacity.perf.mjs
 *
 * T-0021（qa-at）：TC-094（NFR-007）——500 筆容量下的 API 回應時間
 * （5 次取中位數 < 2 秒）與回應結構（不得含分頁欄位，BR-027）。
 * 前端「可互動時間 < 3 秒」需真實瀏覽器渲染量測，交由
 * `tests/e2e/`（Playwright）以 Chromium 對同一批資料量測，本腳本只覆蓋
 * API 側；若要在同一輪次跑，先執行本腳本種好 500 筆，再用
 * `BASE_URL=... npx playwright test tests/e2e/nfr007-render.e2e.test.ts`
 * （若該檔存在，見 AT 報告是否已補上前端量測結果）。
 *
 * 執行：`node tests/perf/tc094-nfr007-capacity.perf.mjs`
 * 完成後**保留**這 500 筆（供後續 e2e 前端量測沿用），腳本結尾印出這批
 * 資料的 id 清單存放路徑，供之後清理。
 */
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
const USER = process.env.STAGING_BASIC_AUTH_USER ?? process.env.BASIC_AUTH_USER ?? "dev";
const PASSWORD = process.env.STAGING_BASIC_AUTH_PASSWORD ?? process.env.BASIC_AUTH_PASSWORD ?? "dev";
const AUTH_HEADER = `Basic ${Buffer.from(`${USER}:${PASSWORD}`, "utf-8").toString("base64")}`;
const TOTAL = Number(process.env.PERF_CAPACITY_COUNT ?? 500);
const BATCH = 20;

async function createOne(i) {
  const response = await fetch(`${BASE_URL}/api/v1/todos`, {
    method: "POST",
    headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
    body: JSON.stringify({ title: `TC-094：容量集-${i}` })
  });
  if (response.status !== 201) {
    throw new Error(`第 ${i} 筆建立失敗：${response.status}`);
  }
  const body = await response.json();
  return body.id;
}

async function main() {
  console.log(`BASE_URL=${BASE_URL}  目標筆數=${TOTAL}`);

  const ids = [];
  const seedStart = performance.now();
  for (let start = 0; start < TOTAL; start += BATCH) {
    const chunk = Array.from({ length: Math.min(BATCH, TOTAL - start) }, (_, k) => start + k);
    const chunkIds = await Promise.all(chunk.map((i) => createOne(i)));
    ids.push(...chunkIds);
  }
  console.log(`建立 ${ids.length} 筆耗時 ${((performance.now() - seedStart) / 1000).toFixed(1)} 秒`);

  const timings = [];
  let lastBody = null;
  for (let i = 0; i < 5; i += 1) {
    const start = performance.now();
    const response = await fetch(`${BASE_URL}/api/v1/todos`, { headers: { authorization: AUTH_HEADER } });
    const text = await response.text();
    const elapsed = performance.now() - start;
    timings.push(elapsed);
    lastBody = text;
    console.log(`第 ${i + 1} 次：status=${response.status} time_total=${elapsed.toFixed(1)}ms`);
  }

  const sorted = [...timings].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(`\n=== TC-094 結果 ===`);
  console.log(`5 次中位數：${median.toFixed(1)}ms（門檻 < 2000ms） → ${median < 2000 ? "PASS" : "FAIL"}`);

  let parsed;
  try {
    parsed = JSON.parse(lastBody);
  } catch {
    parsed = null;
  }
  const isArray = Array.isArray(parsed);
  const hasPaginationFields = !isArray && parsed && ("page" in parsed || "totalPages" in parsed || "nextCursor" in parsed);
  console.log(`回應為單一完整陣列（非分頁結構）：${isArray && !hasPaginationFields ? "PASS" : "FAIL"}（isArray=${isArray}）`);
  console.log(`陣列長度（含既有資料）：${isArray ? parsed.length : "n/a"}`);

  const orderOk = isArray
    ? parsed.slice(0, -1).every((todo, idx) => new Date(todo.createdAt).getTime() >= new Date(parsed[idx + 1].createdAt).getTime())
    : false;
  console.log(`順序符合 created_at DESC：${orderOk ? "PASS" : "FAIL（可能因既有資料 createdAt 相同或非本腳本種入）"}`);

  // 憑證一律不落地字面值（07 §6.2）：即使是本機佔位密碼，也不把組好的
  // Base64 authorization 標頭印進 stdout／報告，改印一段讀取環境變數的
  // 清理腳本，由執行者在自己的 shell 貼上執行（AUTH_HEADER 於當下重新組出）。
  console.log(`\n本批 500 筆 id 已建立於 ${BASE_URL}，可用下列指令清空（如需回收，於同一 shell 先備妥 $BASIC_AUTH_USER/$BASIC_AUTH_PASSWORD 或 $STAGING_BASIC_AUTH_USER/$STAGING_BASIC_AUTH_PASSWORD）：`);
  console.log(
    `  node -e "const ids=${JSON.stringify(ids)}; const u=process.env.STAGING_BASIC_AUTH_USER??process.env.BASIC_AUTH_USER; const p=process.env.STAGING_BASIC_AUTH_PASSWORD??process.env.BASIC_AUTH_PASSWORD; const auth='Basic '+Buffer.from(u+':'+p).toString('base64'); (async()=>{for(const id of ids){await fetch('${BASE_URL}/api/v1/todos/'+id,{method:'DELETE',headers:{authorization:auth}})}})()"`
  );

  process.exit(median < 2000 && isArray && !hasPaginationFields ? 0 : 1);
}

main().catch((error) => {
  console.error("perf 腳本執行失敗：", error);
  process.exit(2);
});
