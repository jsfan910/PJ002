---
doc: DEPLOY
title: 部署架構與 CI/CD
epic: E-000
version: 0.1
status: draft
author: plan-sd        # 設計階段由 plan-sd 起草；開發階段由 dev-ops 補實作細節
reviewers: [dev-tl, dev-ops]
updated: 2026-01-01T00:00:00+08:00
---

# 部署架構與 CI/CD：{Epic 名稱}

## 1. 環境清單

| 環境 | 用途 | 網址 | 誰可部署 | 資料 |
|---|---|---|---|---|
| dev | 本機 | localhost | 任何人 | 假資料 |
| staging | 測試團隊驗證 | | CI 自動（main 綠燈） | 匿名化 |
| prod | | | Leader 核准後 | 真實 |

## 2. 雲端資源清單（依 ADR-0003）

| 資源 | 規格 | 用途 | 費用估計 |
|---|---|---|---|

## 3. Pipeline 階段（GitHub Actions）

| 階段 | 觸發 | 做什麼 | 失敗時 |
|---|---|---|---|
| lint | PR | | 阻擋合併 |
| unit | PR | | 阻擋合併 |
| build | PR / main | | |
| integration | main | | 阻擋部署 |
| deploy-staging | main 綠燈 | | 通知 dev-ops |
| deploy-prod | 手動 | | |

## 4. 環境變數清單（只列名稱與用途，值不入版控）

| 名稱 | 用途 | 環境 | 來源（secrets 管理） |
|---|---|---|---|

## 5. 回滾程序（必須實際演練過一次，記錄日期與結果）

1.
2.

- 演練紀錄：yyyy-mm-dd，結果：

## 6. 監控與告警

-
