# 待辦看板（tasks/_todo.md）

事實來源是各任務卡 frontmatter；本檔由 Leader 以 `/dispatch` 重新彙整。引言區（本段到第一個 `## ` 之前）只放一行指向當日交接檔。

> 本日交接見 `worklog/handoff/20260919-工作交接.md`。Gate 1 已通過（2026-09-19），開發階段進行中；雲端改 Cloud Run（T-0010）。

## 進行中

（無）

（無）

（無）

（無）

## 審核中

- T-0016 待辦 API（c88f9e8）｜ reviewer dev-tl ｜ 09:50 初審中

（無）

（無）

（無）

（無）

## 阻塞

（無）

## 待辦（開發批次，依 WBS §2）


- 批次 5（平行）：T-0017 前端狀態與呈現 ｜ dev-fe/sonnet ｜ 依賴 T-0014, T-0016；T-0018 staging 部署與監測 ｜ dev-ops/sonnet ｜ 依賴 T-0010, T-0011, T-0015, T-0016

## 待辦（測試階段，開發合併完成後開）

- T-0020 P0 全量 Code Review ｜ qa-cr/opus ｜ 依賴 T-0017, T-0018
- T-0021 自動化測試＋README 15 分鐘實測 ｜ qa-at/sonnet ｜ 依賴 T-0017, T-0018（與 T-0020 平行）
- T-0022 UAT ｜ qa-uat/haiku ｜ 依賴 T-0018（與 T-0020/T-0021 平行）
- T-0023 缺陷清單＋測試總結 ｜ qa-lead/opus ｜ 依賴 T-0020, T-0021, T-0022
