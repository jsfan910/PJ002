---
doc: WBS
title: 開發計畫
epic: E-000
author: dev-tl
reviewers: [leader]
updated: 2026-01-01T00:00:00+08:00
---

# 開發計畫（WBS）：{Epic 名稱}

輸入：規格包（SRS/SA/SD/API/DB/部署）。DoD：每個工作項對應一張任務卡，有依賴、估計回合數、對應 SD 模組；outputs 互不重疊。

## 1. 工作項

| WI | 標題 | 角色 | SD 模組 | API/UC | 依賴 | 估計回合 | 任務卡 | outputs |
|---|---|---|---|---|---|---|---|---|
| WI-01 | 專案骨架與 CI | dev-ops | — | — | — | 1 | T- | infra/, .github/workflows/ |
| WI-02 | | dev-be | | | WI-01 | | T- | src/… |

## 2. 平行批次

- 批次 1（無依賴）：WI-01
- 批次 2：WI-02, WI-03（平行）
- 批次 3：…

## 3. 分支與合併策略

- 每卡一分支 `task/T-####-slug`，自 `main` 切出。
- 合併條件：CI 綠燈 + dev-tl 初審通過 + qa-cr 阻擋級 0。
- 合併由 dev-tl 執行，commit 訊息 `T-####: 摘要`。

## 4. 風險

| 風險 | 對策 |
|---|---|
