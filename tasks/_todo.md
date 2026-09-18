# 待辦看板（tasks/_todo.md）

事實來源是各任務卡 frontmatter；本檔由 Leader 以 `/dispatch` 重新彙整。引言區（本段到第一個 `## ` 之前）只放一行指向當日交接檔。

> 本日交接見 `worklog/handoff/20260919-工作交接.md`。Gate 1 已通過（2026-09-19），開發階段進行中；雲端改 Cloud Run（T-0010）。

## 進行中

- T-0011 專案骨架＋CI＋/health＋README ｜ dev-ops/sonnet ｜ r1 ｜ 07:45 派工（批次 1）
- T-0019 測試計畫同步 Cloud Run＋追溯補欄 ｜ qa-lead/opus ｜ r1 ｜ 07:45 派工
- T-0010 補修 commit（SD 三處、API servers）｜ plan-sd/opus ｜ 已 done，追加修正中

## 審核中

（無）

## 阻塞

（無）

## 待辦（開發批次，依 WBS §2）


- 批次 2（平行）：T-0012 錯誤處理器 ｜ dev-be/sonnet；T-0013 資料層 ｜ dev-be/sonnet；T-0014 前端版面與 API client ｜ dev-fe/sonnet ｜ 皆依賴 T-0011
- 批次 3：T-0015 Basic Auth／靜態託管 ｜ dev-be/sonnet ｜ 依賴 T-0011, T-0012, T-0014
- 批次 4：T-0016 待辦 API ｜ dev-be/sonnet ｜ 依賴 T-0012, T-0013, T-0015
- 批次 5（平行）：T-0017 前端狀態與呈現 ｜ dev-fe/sonnet ｜ 依賴 T-0014, T-0016；T-0018 staging 部署與監測 ｜ dev-ops/sonnet ｜ 依賴 T-0010, T-0011, T-0015, T-0016
