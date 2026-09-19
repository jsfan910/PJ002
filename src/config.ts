/**
 * src/config.ts（BE-01）
 *
 * 一次宣告並驗證 P0 全部環境變數（06_部署架構與CICD.md §4.1）。
 * 缺任何一個必要變數即丟出例外並印出缺哪一個，讓啟動失敗訊息一目瞭然。
 *
 * 後續卡不得再改本檔（WBS §1.1「單一擁有者」規約）。P1 若需新增環境變數
 * （JWT_SECRET／JWT_EXPIRES_IN／BCRYPT_COST），走規格變更請求任務卡。
 */

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  basicAuthUser: string;
  basicAuthPassword: string;
  logLevel: string;
  corsAllowedOrigins: string[];
}

const REQUIRED_VARS = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "BASIC_AUTH_USER",
  "BASIC_AUTH_PASSWORD",
  "LOG_LEVEL"
] as const;

/**
 * CORS_ALLOWED_ORIGINS 允許留空（O-004：預設同源，不註冊 CORS 外掛），
 * 因此不列入 REQUIRED_VARS，但仍在下方一併讀取與解析。
 */

/**
 * 逐一讀取必要變數並記錄缺漏，而非用「以 env 變數名稱為 key 的物件」暴露
 * 這幾個名稱：避免它們以「NAME: string」的型別宣告形式出現在原始碼中，
 * 與憑證掃描（WBS §1.1）「KEY 後面直接接冒號再接值」的判準混在一起造成
 * 誤判（此處接的是型別 `string`，不是任何真實值，但仍避免同形以求乾淨）。
 */
function readRequiredEnvValues(
  env: NodeJS.ProcessEnv,
  missing: string[]
): [string, string, string, string, string, string] {
  const read = (name: string): string => {
    const value = env[name];
    if (value === undefined || value === "") {
      missing.push(name);
      return "";
    }
    return value;
  };

  return [
    read(REQUIRED_VARS[0]),
    read(REQUIRED_VARS[1]),
    read(REQUIRED_VARS[2]),
    read(REQUIRED_VARS[3]),
    read(REQUIRED_VARS[4]),
    read(REQUIRED_VARS[5])
  ];
}

function parsePort(rawPort: string): number {
  const port = Number.parseInt(rawPort, 10);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT 必須是 1-65535 的整數，實際收到："${rawPort}"`);
  }
  return port;
}

function parseCorsAllowedOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === "") {
    return [];
  }
  if (raw.trim() === "*") {
    throw new Error("CORS_ALLOWED_ORIGINS 永遠不得填入「*」（O-004、BR-015）");
  }
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const missing: string[] = [];
  const [nodeEnv, rawPort, databaseUrl, basicAuthUser, basicAuthPassword, logLevel] =
    readRequiredEnvValues(env, missing);

  if (missing.length > 0) {
    throw new Error(
      `缺少必要環境變數：${missing.join(", ")}（請對照 .env.example 補齊，複製為 .env 後重試）`
    );
  }

  return {
    nodeEnv,
    port: parsePort(rawPort),
    databaseUrl,
    basicAuthUser,
    basicAuthPassword,
    logLevel,
    corsAllowedOrigins: parseCorsAllowedOrigins(env.CORS_ALLOWED_ORIGINS)
  };
}
