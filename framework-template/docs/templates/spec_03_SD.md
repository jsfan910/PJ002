---
doc: SD
title: 系統設計書
epic: E-000
version: 0.1
status: draft
author: plan-sd
reviewers: [plan-sa, dev-tl]
updated: 2026-01-01T00:00:00+08:00
---

# 系統設計書（SD）：{Epic 名稱}

輸入：SRS、SA。技術選型一律附 ADR 編號。dev-tl 審核重點：能否據此拆 WBS。

## 1. 架構總覽

### 1.1 C4 Level 1（系統情境）
```mermaid
C4Context
```
### 1.2 C4 Level 2（容器）
```mermaid
C4Container
```

## 2. 技術選型（每項附 ADR）

| 項目 | 選擇 | ADR |
|---|---|---|
| 語言／框架 | | ADR-0001 |
| 資料庫 | | ADR-0002 |
| 雲端／部署 | | ADR-0003 |
| CI/CD | GitHub Actions（預設） | |

## 3. 模組設計

| 模組 | 職責 | 對應 UC | 介面（輸入／輸出） | 依賴 |
|---|---|---|---|---|

## 4. 資料模型

（摘要；完整見 `05_資料庫設計.md`）

## 5. API 設計摘要

（完整見 `04_API規格.yaml`；此處列端點與對應 UC）

| 端點 | 方法 | 對應 UC | 認證 |
|---|---|---|---|

## 6. 錯誤處理與安全設計

- 錯誤碼規範：
- 認證／授權：
- 輸入驗證：
- 敏感資料處理：
- 日誌與稽核：

## 7. 非功能設計（對應 NFR）

| NFR-ID | 設計對策 | 驗證方式 |
|---|---|---|

## 8. 目錄結構與分支策略（給 dev-tl）

```
src/
tests/
infra/
```
- 分支：`main` 受保護；每卡 `task/T-####-slug`；合併由 dev-tl。

## 9. 開放問題

-
