/**
 * src/db/pool.ts（BE-08 db-migration 模組之一：連線池）
 *
 * `pg.Pool` 的建立與匯出。`max: 5`（SD §7 NFR-001 對策②、ADR-0002「後果」
 * 第 2 點）：限制併發連線數，同時 Neon 免費方案閒置後會自動暫停運算，
 * 應用啟動即建立連線池具備保溫效果，緩解冷啟延遲。
 *
 * 本檔只負責「建立」，不負責何時 `.end()`——生命週期由呼叫端（`server.ts`
 * 或測試）管理，本卡不動 `src/app.ts`／`src/server.ts`（無錨點）。
 */
import { Pool } from "pg";

/** 只取用 `databaseUrl`，讓呼叫端可直接傳入 `AppConfig`（含更多欄位）。 */
export interface DatabaseConfig {
  databaseUrl: string;
}

export function createPool(config: DatabaseConfig): Pool {
  return new Pool({
    connectionString: config.databaseUrl,
    max: 5
  });
}
