/**
 * scripts/verify-health.ts（T-0018，OPS-03）
 *
 * 本機與 CI 部署工作流共用的健康檢查驗證腳本
 * （WBS §1.8「每個 run step 的實際指令都要有等價的本地 npm script」；
 * `npm run verify:health`，package.json 由 T-0011 建立，本卡補實作）。
 *
 * 對 `${BASE_URL}/health` 輪詢直到回 200 或逾時；逾時以非 0 結束。
 * 本機預設值適合 docker compose／npm start 起服務後立即驗證；
 * `.github/workflows/deploy-staging.yml` 的 verify 階段以環境變數覆寫
 * 為 06 §3.2 規定的「每 10 秒一次、上限 5 分鐘」（Cloud Run 冷啟僅
 * 1-3 秒，見 ADR-0005，5 分鐘已含相當餘裕）。
 *
 * 環境變數：
 *   BASE_URL              預設 http://localhost:8080（不含結尾斜線）
 *   POLL_INTERVAL_SECONDS 預設 2
 *   POLL_TIMEOUT_SECONDS  預設 60
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const INTERVAL_SECONDS = Number(process.env.POLL_INTERVAL_SECONDS ?? "2");
const TIMEOUT_SECONDS = Number(process.env.POLL_TIMEOUT_SECONDS ?? "60");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  const url = `${BASE_URL}/health`;
  const deadline = Date.now() + TIMEOUT_SECONDS * 1000;
  let attempt = 0;

  for (;;) {
    attempt += 1;
    try {
      const res = await fetch(url);
      console.log(`[verify-health] 第 ${attempt} 次：${res.status} ${url}`);
      if (res.status === 200) {
        process.exitCode = 0;
        return;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`[verify-health] 第 ${attempt} 次：連線失敗 - ${reason}`);
    }

    if (Date.now() + INTERVAL_SECONDS * 1000 > deadline) {
      break;
    }
    await sleep(INTERVAL_SECONDS * 1000);
  }

  console.error(`[verify-health] 逾時：${TIMEOUT_SECONDS} 秒內未取得 200（${url}）`);
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
