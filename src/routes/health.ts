/**
 * src/routes/health.ts（BE-07）
 *
 * GET /health —— 全站唯一未保護路徑（BR-017、O-005）。
 * 只回程序存活狀態，刻意不查資料庫，避免資料庫抖動造成誤判與不必要的
 * 實例重啟（NFR-003 設計對策②）；回應不含任何業務資料或內部細節。
 * 同時作為 Cloud Run 的 startup probe 路徑（ADR-0005）。
 */
import type { FastifyInstance } from "fastify";

export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return { status: "ok" };
  });
}
