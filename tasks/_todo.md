# 待辦看板（tasks/_todo.md）

事實來源是各任務卡 frontmatter；本檔由 Leader 以 `/dispatch` 重新彙整。引言區（本段到第一個 `## ` 之前）只放一行指向當日交接檔。

> 本日交接見 `worklog/handoff/20260919-工作交接.md`。**E-001 Gate 2 報告已提交使用者（`docs/reports/20260919-1410-Gate2-E001.md`）：本機範圍全達標、staging 阻擋，等使用者判定與 staging 設定。**

## 進行中

- T-0027 staging 部署 ｜ dev-ops/sonnet ｜ r1 ｜ 使用者修正 WIF 後重新觸發，接續中

（無）

（無）

## 審核中

（無）

## 阻塞

（無）

（無）

## 待辦（Gate 2 後）

- P1：US-011～US-013 多使用者帳號（依 WBS §8，開卡前 Leader 依使用者裁決②決定時機）
- P1 併卡：CR N-1 runMigrations 互斥鎖（與 002 migration 同卡）；unit 層 TC-ID 標註（測試總結裁決 C）
- Firefox 相容性兩組於非沙盒環境補跑（NFR-004）
- staging 首次部署後回填 API 規格 servers（T-0018 裁決①）
