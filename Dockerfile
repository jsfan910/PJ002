# syntax=docker/dockerfile:1
#
# Cloud Run 形狀（ADR-0005）：
#   - 監聽 $PORT（由 Cloud Run 注入，容器不得寫死埠號；本機 compose 亦以
#     環境變數帶入，見 docker-compose.yml／src/config.ts）。
#   - runtime 為 node:22-alpine，非 root 使用者執行。
#   - 多階段建置：builder 裝全部相依並編譯 TypeScript，runtime 只留
#     production 相依與編譯產物，映像精簡（目標 ~150MB 內）。
#   - 不含任何 Render 專屬設定、不含任何憑證值。
#
# 已知後續事項（寫入交接檔「下一步建議」，本卡不預先實作）：WI-04（T-0014）
# 建立 public/ 後、WI-05（T-0015）註冊 @fastify/static 之前，本 Dockerfile
# 需新增一行 `COPY public ./public`（於兩階段皆需）；目前 app.ts 尚未註冊
# static 外掛，public/ 亦不存在，故本卡不預先加這一行。

# ---- Stage 1: builder ----
FROM node:22-alpine AS builder
WORKDIR /app

# 先只複製 manifest 以最大化 Docker layer cache 命中率。
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# 非 root 使用者執行（Cloud Run 與本機皆適用）。
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
  && chown -R appuser:appgroup /app
USER appuser

# EXPOSE 僅供文件用途；容器實際監聽的埠一律讀 $PORT（src/config.ts／
# src/server.ts），Cloud Run 會自行注入，本機 compose 預設 8080。
EXPOSE 8080

CMD ["node", "dist/server.js"]
