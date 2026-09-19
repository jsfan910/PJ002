# 待辦看板（tasks/_todo.md）

事實來源是各任務卡 frontmatter；本檔由 Leader 以 `/dispatch` 重新彙整。引言區（本段到第一個 `## ` 之前）只放一行指向當日交接檔。

> 本日交接見 `worklog/handoff/20260919-工作交接.md`。Gate 1 已通過；P0 開發 8 卡全部合併（main df4071b）；測試階段進行中。staging 實際部署待使用者提供 GitHub repo 與 GCP 設定（README「部署與 secrets」）。

## 進行中

- CR 修正（平行，各自 worktree，12:05 派工）：T-0024 後端 B-1/B-2/S-1/S-2 ｜ dev-be/sonnet；T-0025 DevOps S-3/4/7/9/10/11 ｜ dev-ops/sonnet；T-0026 前端 S-5/S-6 ｜ dev-fe/sonnet

- T-0021 自動化測試＋README 實測 ｜ qa-at/sonnet ｜ r1 ｜ 11:40 派工（worktree）
- T-0022 UAT（staging 未就緒改本機）｜ qa-uat/haiku ｜ r1 ｜ 11:40 派工

## 審核中

- T-0020 Code Review（f0e8789，結論退回：阻擋 2、建議 11）｜ reviewer qa-lead（於 T-0023 彙整）

（無）

## 阻塞

（無）

## 待辦

- T-0023 缺陷清單＋測試總結 ｜ qa-lead/opus ｜ 依賴 T-0020, T-0021, T-0022
- （待使用者）staging 首次部署後：API servers 回填小卡、回滾演練、NFR-003 24 小時採樣
