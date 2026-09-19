# 待辦看板（tasks/_todo.md）

事實來源是各任務卡 frontmatter；本檔由 Leader 以 `/dispatch` 重新彙整。引言區（本段到第一個 `## ` 之前）只放一行指向當日交接檔。

> 本日交接見 `worklog/handoff/20260919-工作交接.md`。Gate 1 已通過；P0 開發 8 卡全部合併（main df4071b）；測試階段進行中。staging 實際部署待使用者提供 GitHub repo 與 GCP 設定（README「部署與 secrets」）。

## 進行中

- T-0021 r2 AT 對最終 main 重跑 ｜ qa-at/sonnet ｜ 13:15 派工

（無）
（無）

（無）


## 審核中

- T-0020 r2 CR（5a346b1，阻擋 0）｜ reviewer qa-lead（T-0023）
- T-0022 r2 UAT（10/10）｜ reviewer qa-lead（T-0023）

（無）

（無）


（無）

## 阻塞

（無）

## 待辦

- T-0023 缺陷清單＋測試總結 ｜ qa-lead/opus ｜ 依賴 T-0020, T-0021, T-0022
- （待使用者）staging 首次部署後：API servers 回填小卡、回滾演練、NFR-003 24 小時採樣
