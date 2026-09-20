# 待辦看板（tasks/_todo.md）

事實來源是各任務卡 frontmatter；本檔由 Leader 以 `/dispatch` 重新彙整。引言區（本段到第一個 `## ` 之前）只放一行指向當日交接檔。

> 本日交接見 `worklog/handoff/20260920-工作交接.md`。

## 進行中

| 卡號 | 標題 | 角色／模型 | 回合 | 派工時間 | 備註 |
|---|---|---|---|---|---|
| T-0044 | 第二個 uptime check＋告警政策；06 §6.1.1／§6.9.1 回填 | dev-ops／sonnet | 1 | 2026-09-20 20:17 | worktree T-0044；通知管道 email 由使用者自綁 |

## 審核中

| 卡號 | 標題 | 審核者 | 備註 |
|---|---|---|---|

## 阻塞

| 卡號／項目 | 阻塞原因 | 解除條件 |
|---|---|---|
| T-0041 Firefox 兩組補跑 | agent 執行環境無法啟動 firefox.exe（Windows CreateProcess `spawn UNKNOWN`；Chromium 對照正常、二進位檔已重下、非 Docker 問題），判工具限制非產品缺陷 | 使用者在自己的終端執行報告 §「單一指令」；結果貼回後由 qa-lead 更新 TC-091。非擋關；T-0042 已解除對本卡的依賴 |

## 待辦

| 卡號 | 標題 | 角色／模型 | 依賴 | 備註 |
|---|---|---|---|---|
| — | staging Basic Auth 帳密輪換 | **使用者** | — | Gate 2 r2 條件；Secret Manager 對 basic-auth-user／basic-auth-pass 各加新版本後，重跑一次 deploy-staging 即自動釘到最新版（T-0039 已生效） |
| — | D-017 關閉：staging 重跑 TC-067／TC-009 5 次 | **使用者跑指令**＋qa-lead 判定 | T-0038 已上 staging（revision 00017-qg4） | 指令見 Leader 回覆；摘要貼回後 qa-lead 出測試總結 r4 關閉 D-017、認定 R-6、更新第 10 項 |
| — | QA Tests workflow run #17（sha 6b27611）integration-qa 步驟紅 | qa-at | — | dev-tl 證實與 T-0039 無因果（src/tests 無差異）；job log 需 repo admin；先由使用者貼 log 或 qa-at 本機重跑 test:integration:qa 判 flaky |

## 待辦（Gate 2 後）

| 項目 | 角色 | 備註 |
|---|---|---|
| P1：US-011～US-013 多使用者帳號 | 依 WBS §8 | 使用者裁決③ A：待辦五卡清完後開；第一張卡含 CR N-1 互斥鎖與 002 migration TRUNCATE（SD-02） |
| 20_測試案例 TC-079 判準文字 301→3xx；SD 變更紀錄表錯置的 SD-05 列 | qa-lead／plan-sd | 隨 P1 規格與測試計畫同步卡處理（T-0040 已改 06／ADR／SD §7） |
| TC-080 直接比對、D-017 staging 重跑、Firefox staging 重跑 | qa-at（需憑證） | 留 P1 staging 測試輪 |
| 07 §4 第 1 項判準改為「不通過 0 且未達通過者皆有裁決處置」 | E-002 框架 v1.2 | T-0037 裁決事項 A 選項 3；不在本 Epic 改 |
