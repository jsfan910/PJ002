/**
 * tests/perf/tc090-deploy-downtime.perf.mjs
 *
 * T-0021（qa-at）：TC-090（NFR-003 後半）——單次部署造成的不可用時間，
 * 門檻為最長連續失敗時長 < 60 秒。
 *
 * 用法：在觸發一次部署（`deploy-staging.yml` 或本機等效
 * `scripts/deploy-staging.sh`）**之前**先啟動本腳本（背景執行），每 5 秒
 * `GET $BASE_URL/health` 並記錄時間戳與結果；部署完成後手動 Ctrl+C 或
 * 等待 `PERF_POLL_MAX_MS`（預設 20 分鐘）逾時自動停止，腳本印出最長連續
 * 失敗時長。
 *
 * **現實條件**：staging 尚未部署，本卡未實跑（阻擋，環境未就緒）；
 * 腳本已備妥，$BASE_URL 回填後即可直接對 staging 重跑，不需改碼。
 */
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
const POLL_INTERVAL_MS = Number(process.env.PERF_POLL_INTERVAL_MS ?? 5000);
const MAX_MS = Number(process.env.PERF_POLL_MAX_MS ?? 20 * 60 * 1000);

async function poll() {
  const records = [];
  const start = Date.now();
  console.log(`開始輪詢 ${BASE_URL}/health，每 ${POLL_INTERVAL_MS}ms 一次，最長 ${MAX_MS}ms（Ctrl+C 可提前停止）`);

  while (Date.now() - start < MAX_MS) {
    const timestamp = new Date().toISOString();
    let ok = false;
    try {
      const response = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      ok = response.status === 200;
    } catch {
      ok = false;
    }
    records.push({ timestamp, ok });
    console.log(`${timestamp}  ${ok ? "OK" : "FAIL"}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  let longestFailMs = 0;
  let currentFailStart = null;
  for (let i = 0; i < records.length; i += 1) {
    if (!records[i].ok) {
      if (currentFailStart === null) currentFailStart = new Date(records[i].timestamp).getTime();
      const end = new Date(records[i].timestamp).getTime();
      longestFailMs = Math.max(longestFailMs, end - currentFailStart + POLL_INTERVAL_MS);
    } else {
      currentFailStart = null;
    }
  }

  console.log(`\n=== TC-090 結果 ===`);
  console.log(`取樣筆數：${records.length}`);
  console.log(`最長連續失敗時長（估計，取樣間隔 ${POLL_INTERVAL_MS}ms）：${(longestFailMs / 1000).toFixed(1)} 秒`);
  console.log(`門檻 < 60 秒 → ${longestFailMs < 60000 ? "PASS" : "FAIL"}`);
  console.log(JSON.stringify(records));
}

poll().catch((error) => {
  console.error("輪詢腳本執行失敗：", error);
  process.exit(2);
});
