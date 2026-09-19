# 待辦看板（tasks/_todo.md）

事實來源是各任務卡 frontmatter；本檔由 Leader 以 `/dispatch` 重新彙整。引言區（本段到第一個 `## ` 之前）只放一行指向當日交接檔。

> 本日交接見 `worklog/handoff/20260919-工作交接.md`。E-001：Gate 1 通過；P0 開發與本機測試全部完成；staging 已部署（https://todo-app-dpevsdhdva-de.a.run.app）；Gate 2 報告 r1 已提交，staging 補驗進行中，NFR-003 需 24 小時採樣。

## 進行中

| 卡號 | 標題 | 角色／模型 | 回合 | 派工時間 | 備註 |
|---|---|---|---|---|---|
| T-0028 | AT r3：對 staging 重跑三類測試、補 8 條阻擋 TC、NFR-003 採樣判讀 | qa-at / sonnet | 1 | 16:40 | worktree task/T-0028-at-staging |
| T-0029 | UAT r2：於 staging 逐 P0 使用者故事操作 | qa-uat / sonnet（r2 升級） | 2 | 17:00 | r1（haiku）誤判前端連線為阻擋，Leader 以瀏覽器實測 API 200 證偽 |

## 審核中

| 卡號 | 標題 | 審核者 | 備註 |
|---|---|---|---|
| （無） | | | |

## 阻塞

| 卡號／項目 | 阻塞原因 | 解除條件 |
|---|---|---|
| （無） | | |

## 待辦

| 卡號 | 標題 | 角色／模型 | 依賴 | 備註 |
|---|---|---|---|---|
| T-0030 | 測試總結 r2（含 staging 證據）與 Gate 2 最終建議 | qa-lead / opus | T-0028, T-0029 | NFR-003 未滿 24 小時則標「採樣中」 |
| — | Gate 2 報告 r2 | leader | T-0030 | NFR-003 採樣起算 2026-09-19T17:07:43+08:00，滿 24 小時後判讀 |

## 待辦（Gate 2 後）

| 項目 | 角色 | 備註 |
|---|---|---|
| P1：US-011～US-013 多使用者帳號 | 依 WBS §8 | 使用者裁決②決定時機；第一張卡含 CR N-1 互斥鎖與 002 migration TRUNCATE（SD-02） |
| unit 層 TC-ID 標註 | dev-tl | 測試總結裁決 C |
| Firefox 相容性兩組於非沙盒環境補跑 | qa-at | NFR-004 |
| 維運小卡：secret 釘具體版本、verify 失敗自動重建 revision 重試 | dev-ops | 06 §6.7 建議 |
| staging 帳密輪換 | 使用者 + dev-ops | 驗收後執行（帳密曾出現在對話） |
