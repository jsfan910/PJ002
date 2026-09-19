/**
 * tests/perf/lib/load-runner.mjs
 *
 * T-0021（qa-at）：NFR-001／NFR-007 效能腳本共用的簡易負載產生器，以
 * Node 內建 `fetch` 自寫（任務卡「用 autocannon 或 node 內建 fetch 自寫」
 * 二選一，本卡選後者：避免另外安裝套件、輸出格式完全自己掌控）。
 *
 * 做法：維持固定數量（`concurrency`）的並行「worker」，每個 worker 在
 * `durationMs` 時間內連續送出 `requestFn()`，記錄每次耗時（毫秒）；
 * 回傳完整耗時陣列供呼叫端計算 P50／P95／P99。
 */

/**
 * @param {() => Promise<{ ok: boolean; status: number }>} requestFn
 * @param {{ concurrency: number; durationMs: number }} options
 * @returns {Promise<{ durationsMs: number[]; errors: number; total: number }>}
 */
export async function runLoad(requestFn, { concurrency, durationMs }) {
  const durationsMs = [];
  let errors = 0;
  let total = 0;
  const deadline = Date.now() + durationMs;

  async function worker() {
    while (Date.now() < deadline) {
      const start = performance.now();
      total += 1;
      try {
        const result = await requestFn();
        const elapsed = performance.now() - start;
        durationsMs.push(elapsed);
        if (!result.ok) {
          errors += 1;
        }
      } catch {
        errors += 1;
        durationsMs.push(performance.now() - start);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { durationsMs, errors, total };
}

/**
 * @param {number[]} values
 * @param {number} percentile 0~100
 */
export function percentile(values, percentileValue) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))];
}

export function summarize(durationsMs) {
  // 不用 Math.min(...durationsMs)：高併發長時間取樣後陣列可達數萬筆，
  // 展開成函式參數會超過 JS engine 的呼叫堆疊上限（實測觸發
  // RangeError: Maximum call stack size exceeded），改用 reduce。
  let min = Infinity;
  let max = -Infinity;
  for (const value of durationsMs) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return {
    count: durationsMs.length,
    min,
    max,
    p50: percentile(durationsMs, 50),
    p95: percentile(durationsMs, 95),
    p99: percentile(durationsMs, 99),
    mean: durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length
  };
}
