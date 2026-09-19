/**
 * src/db/migrate.ts（BE-08 db-migration 模組：migration runner）
 *
 * 行為規格（05_資料庫設計.md §3「migration runner」五條，逐條落實）：
 *   1. 建立 `schema_migrations`（若不存在）。
 *   2. 讀取 `migrations/` 下所有 `.sql`，依檔名排序。
 *   3. 對每個尚未套用的版本，**在單一交易內**執行該檔全文，成功後寫入
 *      `schema_migrations` 再 commit；任一檔失敗即 rollback 該檔並讓整個
 *      程序以非 0 結束（部署工作流據此中止，保留前一版可用）。
 *   4. 供**應用啟動時自動執行**（NFR-008）；本卡 outputs 不含
 *      `src/server.ts`（無錨點／未列出），故尚未接進啟動流程，
 *      亦可由 CI 的部署工作流在觸發部署前以 `npm run migrate` 單獨執行——
 *      見交接檔「下一步建議」。
 *   5. **只前進不回退**：本檔不提供 `down`。
 *
 * 執行方式：`npm run migrate`（= `node src/db/migrate.ts`，package.json 由
 * WI-01 鎖定，本卡不得改）。
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Pool } from "pg";

import { loadConfig } from "../config.js";
import { createPool } from "./pool.js";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

/** `migrations/` 目錄的絕對路徑（相對本檔位置往上兩層）。 */
export const MIGRATIONS_DIR = path.join(CURRENT_DIR, "../../migrations");

interface MigrationFile {
  version: string;
  filename: string;
  sql: string;
}

const VERSION_PREFIX_PATTERN = /^(\d+)_/;

function loadMigrationFiles(dir: string): MigrationFile[] {
  const filenames = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  return filenames.map((filename) => {
    const match = VERSION_PREFIX_PATTERN.exec(filename);
    const version = match?.[1];
    if (version === undefined) {
      throw new Error(`migration 檔名不符 NNN_描述.sql 格式：${filename}`);
    }
    return {
      version,
      filename,
      sql: readFileSync(path.join(dir, filename), "utf8")
    };
  });
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
  );
}

async function fetchAppliedVersions(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ version: string }>("SELECT version FROM schema_migrations");
  return new Set(result.rows.map((row) => row.version));
}

/**
 * 依序套用尚未套用的 migration，回傳本次「新套用」的版本清單。
 * 冪等：全部已套用過時回傳空陣列（第二次執行為 no-op）。
 * 任一檔失敗即 rollback 該檔的交易並向上拋出例外，呼叫端（`main`）
 * 據此以非 0 結束程序；已成功 commit 的前面版本不受影響。
 */
export async function runMigrations(pool: Pool, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  await ensureMigrationsTable(pool);
  const applied = await fetchAppliedVersions(pool);
  const files = loadMigrationFiles(dir);

  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file.version)) {
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(file.sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file.version]);
      await client.query("COMMIT");
      newlyApplied.push(file.version);
    } catch (err) {
      await client.query("ROLLBACK");
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`migration ${file.filename} 執行失敗，已 rollback：${reason}`);
    } finally {
      client.release();
    }
  }

  return newlyApplied;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config);
  try {
    const applied = await runMigrations(pool);
    if (applied.length > 0) {
      console.log(`已套用 migration：${applied.join(", ")}`);
    } else {
      console.log("無待套用的 migration（已是最新版本）。");
    }
  } finally {
    await pool.end();
  }
}

/** 只有被當成 CLI 腳本直接執行時才自動跑；被其他模組 import（例如測試
 *  用來在建表前先套用 migration）時不觸發，避免非預期的 side effect。 */
const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
