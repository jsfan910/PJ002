# 待辦看板（tasks/_todo.md）

事實來源是各任務卡 frontmatter；本檔由 Leader 以 `/dispatch` 重新彙整。引言區（本段到第一個 `## ` 之前）只放一行指向當日交接檔。

> 本日交接見 `worklog/handoff/20260920-工作交接.md`。

## 進行中

| 卡號 | 標題 | 角色／模型 | 回合 | 派工時間 | 備註 |
|---|---|---|---|---|---|
| T-0038 | D-017 修正：前端錯誤訊息時序競態 | dev-fe／sonnet | 1 | 2026-09-20 18:36 | worktree T-0038；compose 埠 8081／5433 |
| T-0039 | 維運：secret 釘具體版本、verify 失敗自動重試 | dev-ops／sonnet | 1 | 2026-09-20 18:36 | worktree T-0039；不讀 secret 值 |
| T-0041 | NFR-004 Firefox 兩組補跑 | qa-at／sonnet | 1 | 2026-09-20 18:36 | 本機 compose 埠 8082／5434；無法啟動則 blocked 並給使用者指令 |

## 審核中

| 卡號 | 標題 | 審核者 | 備註 |
|---|---|---|---|

## 阻塞

| 卡號／項目 | 阻塞原因 | 解除條件 |
|---|---|---|
| （無） | | |

## 待辦

| 卡號 | 標題 | 角色／模型 | 依賴 | 備註 |
|---|---|---|---|---|
| T-0040 | 規格變更請求：06 cron 定位、secret 版本文字、D-016 301→3xx | plan-sd／opus | T-0039 | T-0039 done 後派 |
| T-0042 | unit TC-ID 標註、Release Notes v0.1.0 定版、CHANGELOG | dev-tl／opus | T-0038、T-0039、T-0041 | 三卡 done 後派 |
| — | staging Basic Auth 帳密輪換 | **使用者** | — | Gate 2 r2 條件；Secret Manager 加新版本（README「部署與 secrets」）；T-0039 合併後下一次部署自動釘到最新版 |

## 待辦（Gate 2 後）

| 項目 | 角色 | 備註 |
|---|---|---|
| P1：US-011～US-013 多使用者帳號 | 依 WBS §8 | 使用者裁決③ A：待辦五卡清完後開；第一張卡含 CR N-1 互斥鎖與 002 migration TRUNCATE（SD-02） |
| 20_測試案例 TC-079 判準文字 301→3xx | qa-lead | 隨 P1 測試計畫同步卡處理（T-0040 只改 06／ADR／SRS） |
| TC-080 直接比對、D-017 staging 重跑、Firefox staging 重跑 | qa-at（需憑證） | 留 P1 staging 測試輪 |
| 07 §4 第 1 項判準改為「不通過 0 且未達通過者皆有裁決處置」 | E-002 框架 v1.2 | T-0037 裁決事項 A 選項 3；不在本 Epic 改 |
