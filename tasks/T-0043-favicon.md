---
id: T-0043
title: 補 public/favicon.ico，消除瀏覽器 /favicon.ico 404 造成的 console error（TC-009 於 Edge 必敗）
epic: E-001
team: dev
role: dev-fe
model: sonnet
phase: dev-fix
status: todo
round: 1
depends_on: []
inputs:
  - worklog/handoff/20260920-1902-T0038-r1-dev-tl.md（發現經過：5 次連跑 msedge 兩尺寸 TC-009 固定失敗於「console 應無 error」，21 筆 404 全為 /favicon.ico；main 不含 T-0038 亦重現）
  - docs/specs/20_測試案例.md#TC-009（最後一行斷言）
  - src/plugins/static.ts（@fastify/static 如何對應 public/）
  - public/index.html（是否已宣告 <link rel="icon">）
  - Dockerfile（public/ 已於兩階段 COPY，無需改）
outputs:
  - public/favicon.ico
  - public/index.html（僅在需要加 <link rel="icon" href="/favicon.ico"> 時）
acceptance:
  - `public/favicon.ico` 為合法 ICO（16×16 或 32×32，≤ 5 KB，自製簡單圖示；不得抓取第三方檔案）；本機起服務後 `curl -u <dev 帳密> -sS -o /dev/null -w "%{http_code} %{content_type}" http://localhost:8083/favicon.ico` 回 200 與 image/x-icon（或 image/vnd.microsoft.icon）
  - 不帶憑證時 `/favicon.ico` 回 401（仍受全站 Basic Auth 保護，/health 仍是唯一豁免；貼輸出）
  - 本機 docker compose（PORT=8083、POSTGRES_HOST_PORT=5435）以 msedge 與 chromium 兩尺寸執行 `-g "TC-009"` 連續 5 次全過（貼 5 次摘要）
  - `npm run lint`、`npm run test:unit` 全綠；不動 outputs 以外的檔案；不改 tests/e2e
reviewer: dev-tl
branch: task/T-0043-favicon
created: 2026-09-20T19:30:00+08:00
updated: 2026-09-20T19:30:00+08:00
blocked_reason: null
---

## 目標

讓 TC-009 的「console 無 error」斷言回到只反映產品行為：瀏覽器自動請求 `/favicon.ico` 的 404 不該算成前端錯誤。修法最便宜的是提供一個真的 favicon。

## 背景與限制

- 上游：dev-tl 審核 T-0038 時發現（Leader 2026-09-20 19:30 裁決採 dev-tl 建議①）。
- 下游：T-0038 與本卡合併後，qa-lead 於 staging 重跑 TC-009／TC-067 關閉 D-017。
- 必須遵守：CLAUDE.md 協作協定與工作鐵則；角色檔 `.claude/agents/dev-fe.md`；**在 git worktree `<根目錄>-wt/T-0043` 內作業**；靜態檔由既有 @fastify/static 供應，**不新增路由**（SD 端點清單不變）。
- 埠：8083／5435（8081／5433 為 T-0038 審核用、8082／5434 為 T-0041）。

## 驗收方式

dev-tl：

```bash
git diff --stat main...task/T-0043-favicon           # 只含 public/favicon.ico（與必要時的 index.html）
file public/favicon.ico 2>/dev/null || node -e "const b=require(\"fs\").readFileSync(\"public/favicon.ico\");console.log(b.length, b[0], b[1], b[2], b[3])"   # 0 0 1 0 為 ICO 檔頭
# 起 compose（8083／5435）後
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8083/favicon.ico            # 401
curl -u dev:dev -sS -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8083/favicon.ico   # 200 image/x-icon
for i in 1 2 3 4 5; do BASE_URL=http://localhost:8083 npm run test:e2e -- -g "TC-009"; done
```

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| | | | | |
