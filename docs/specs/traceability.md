---
doc: TRACE
title: 追溯矩陣
epic: E-001
version: 0.1
status: draft
author: plan-ba
reviewers: [qa-lead]
updated: 2026-09-19T06:18:00+08:00
---

# 追溯矩陣：E-001 待辦事項 Web 應用

DoD：無孤兒需求（每個 US 至少一個 UC、一個模組、一個測試案例）；無孤兒測試（每個 TC 對應一個 US）。

**本檔目前狀態（T-0004 r1 後）：`US-ID`、`優先級`、`US 標題`、`UC-ID`、`SD 模組`、`API 端點` 六欄為事實。**
欄位填寫責任：`UC-ID` 由 plan-sa（T-0003）補 —— **已於 2026-09-19 完成**，來源 `docs/specs/02_系統分析書_SA.md` 第 1 章；`SD 模組`、`API 端點` 由 plan-sd（T-0004）補 —— **已於 2026-09-19 完成**，來源 `docs/specs/03_系統設計書_SD.md` 第 3 章模組表與第 5 章 API 摘要、`docs/specs/04_API規格.yaml`；`TC-ID` 由測試團隊補。plan-ba 於 T-0005 反向審核覆蓋度並定稿。
未填欄位一律標 `—`（待補），不得留空以免誤判為「已確認無對應」。

模組編號規則：`BE-xx` 後端、`FE-xx` 前端、`OPS-xx` DevOps，定義見 SD 第 3.1 ~ 3.3 節。

| US-ID | US 標題 | 優先級 | UC-ID | SD 模組 | API 端點 | TC-ID | 狀態 |
|---|---|---|---|---|---|---|---|
| US-001 | 新增待辦 | P0 | UC-001 | BE-04、BE-05、BE-06、FE-02、FE-03、FE-04 | `POST /api/v1/todos` | — | 待測試填 |
| US-002 | 檢視待辦清單 | P0 | UC-002 | BE-04、BE-05、BE-06、FE-02、FE-03、FE-04 | `GET /api/v1/todos` | — | 待測試填 |
| US-003 | 編輯待辦 | P0 | UC-003 | BE-04、BE-05、BE-06、FE-03、FE-04 | `PATCH /api/v1/todos/{todoId}` | — | 待測試填 |
| US-004 | 刪除待辦 | P0 | UC-004 | BE-04、BE-05、BE-06、FE-03、FE-04 | `DELETE /api/v1/todos/{todoId}` | — | 待測試填 |
| US-005 | 切換完成／未完成 | P0 | UC-005 | BE-04、BE-05、BE-06、FE-03、FE-04 | `PATCH /api/v1/todos/{todoId}`（設定目標狀態，冪等，O-002） | — | 待測試填 |
| US-006 | 依狀態篩選 | P0 | UC-006 | BE-04、BE-05、BE-06、FE-03、FE-04 | `GET /api/v1/todos?status=all\|active\|completed`（篩選在後端，O-003） | — | 待測試填 |
| US-007 | 顯示建立時間 | P0 | UC-007 | BE-04、BE-06、FE-04 | `GET /api/v1/todos`、`GET /api/v1/todos/{todoId}`（回應的 `createdAt` 欄位） | — | 待測試填 |
| US-008 | 單頁前端操作 | P0 | UC-008 | BE-09、FE-01、FE-02、FE-03、FE-04 | `GET /`、`GET /assets/*`（靜態頁；本 US 無專屬 API 端點） | — | 待測試填 |
| US-009 | REST API | P0 | UC-009 | BE-01、BE-03、BE-04、BE-05、BE-06 | 全部 `/api/v1/*` 端點 ＋ 統一錯誤物件（`components/schemas/Error`） | — | 待測試填 |
| US-010 | staging 部署 | P0 | UC-010、UC-011 | BE-02、BE-07、BE-08、OPS-01、OPS-02、OPS-03、OPS-04 | `GET /health`（**唯一未保護路徑**，O-005） | — | 待測試填 |
| US-011 | 使用者註冊 | P1 | UC-012 | BE-10、BE-11、BE-12 | `POST /api/v1/auth/register` | — | 待測試填 |
| US-012 | 使用者登入與登出 | P1 | UC-013 | BE-10、BE-11、BE-13 | `POST /api/v1/auth/login`（登出為用戶端清除 JWT，**無端點**，O-006） | — | 待測試填 |
| US-013 | 使用者資料隔離 | P1 | UC-014 | BE-13、BE-05、BE-06、BE-12 | 全部 `/api/v1/todos*` 端點（JWT 授權橫切；跨使用者回 404，O-001） | — | 待測試填 |

合計：13 則 US（P0 十則、P1 三則），與 `docs/specs/01_需求規格書_SRS.md` 第 3 章一致。
UC 合計 14 則（US-010 因「部署驗收」與「存活監測」兩種角色與觸發條件不同而拆為 UC-010、UC-011），與 `docs/specs/02_系統分析書_SA.md` 第 1 章一致；62 條 AC 全數被 UC 覆蓋，對照見該書附錄 A。
SD 模組合計 21 個（後端 13 含 P1 四個、前端 4、DevOps 4），API 端點合計 **9 條**（`/health`、五條 `/api/v1/todos*`、兩條 P1 `/api/v1/auth/*`、靜態頁 `GET /`），與 `docs/specs/03_系統設計書_SD.md` 第 3、5 章及 `docs/specs/04_API規格.yaml` 一致。

## 特殊驗證方式的 AC（由 plan-sd 於 T-0004 收斂）

| AC-ID | 為何特殊 | 判準（測試團隊據此寫 TC） |
|---|---|---|
| AC-009-3 | 原文允許「刪除成功 200 **或** 204」兩個值 | Leader 裁決 O-001 收斂為 **204 No Content，無回應本文**。斷言可寫死 |
| AC-009-5 | 原文的 Given 前提為「前端與 API 部署於**不同來源**」，而 Leader 裁決 O-004 為**同源**，前提不成立 | 改以其規範意圖驗證，**兩條都要通過**：(a) `curl -sSI -u "$USER:$PASS" https://<staging>/api/v1/todos \| grep -i access-control-allow-origin` → **預期無輸出**；(b) 瀏覽器 DevTools Network 中 `/api/v1/*` 請求與頁面同來源，且**無 `OPTIONS` 預檢**。依據 `docs/specs/adr/ADR-0004-認證與同源部署.md` 第 6 點 |
| AC-010-5 | 健康檢查需在**不帶憑證**的情況下回 200，否則無法證明 BR-017 的豁免生效 | `curl -fsS https://<staging>/health` **不帶任何憑證** → `200 {"status":"ok"}`；同時 `curl -sS -o /dev/null -w "%{http_code}" https://<staging>/` **不帶憑證** → `401`（證明只有 `/health` 被豁免） |
| AC-013-2 | 原文允許「404 **或** 403」兩個值 | Leader 裁決 O-001 收斂為 **404**（不洩漏識別碼是否存在），且該筆資料不得被改動 |
| AC-002-4 | 「建立時間由新到舊」在同秒建立時原本無定序 | 排序收斂為 `ORDER BY created_at DESC, id DESC`（`docs/specs/05_資料庫設計.md` 第 2 章），500 筆情境下順序為決定性，斷言可寫死 |

## 驗收條件對照（供測試團隊建立 TC 時取用）

| US-ID | AC 數量 | AC 編號範圍 |
|---|---|---|
| US-001 | 5 | AC-001-1 ~ AC-001-5 |
| US-002 | 4 | AC-002-1 ~ AC-002-4 |
| US-003 | 5 | AC-003-1 ~ AC-003-5 |
| US-004 | 4 | AC-004-1 ~ AC-004-4 |
| US-005 | 4 | AC-005-1 ~ AC-005-4 |
| US-006 | 6 | AC-006-1 ~ AC-006-6 |
| US-007 | 4 | AC-007-1 ~ AC-007-4 |
| US-008 | 5 | AC-008-1 ~ AC-008-5 |
| US-009 | 6 | AC-009-1 ~ AC-009-6 |
| US-010 | 5 | AC-010-1 ~ AC-010-5 |
| US-011 | 5 | AC-011-1 ~ AC-011-5 |
| US-012 | 5 | AC-012-1 ~ AC-012-5 |
| US-013 | 4 | AC-013-1 ~ AC-013-4 |

合計 62 條 AC。

## 非功能需求追溯

`設計對策` 欄由 plan-sd 於 T-0004 補（完整內容見 `docs/specs/03_系統設計書_SD.md` 第 7 章，此處只列落點）；`對應測試` 仍待測試團隊補。

| NFR-ID | 類別 | 設計對策落點（SD 第 7 章） | 驗證責任 | 對應測試 |
|---|---|---|---|---|
| NFR-001 | 效能 | BE-01 連線池、BE-06 索引 `(created_at DESC, id DESC)`、OPS-04 監測兼保溫；量測**先暖身 10 秒** | qa-lead（負載測試） | — |
| NFR-002 | 安全 | 平台 HTTPS ＋ 301（ADR-0003）、BE-03 剝除內部細節、FE-04 全面 `textContent`、ADR-0004 不啟用 CORS | qa-cr + qa-lead | — |
| NFR-003 | 可用性 | BE-07 `/health` 豁免且不查 DB、Render health check 零停機輪替、OPS-04 每 5 分鐘取樣 3 次；**Gate 2 採 24 小時**（O-009） | dev-ops + qa-lead | — |
| NFR-004 | 相容性 | FE-01 無框架、ES2020、flexbox 單一斷點、最小點擊區 44×44 | qa-at | — |
| NFR-005 | 可維運性 | BE-03 唯一錯誤出口、pino `reqId` 與回應 `requestId` **為同一值** | qa-cr | — |
| NFR-006 | 資料持久性 | **由架構保證**：Neon 與運算實例分離；migration forward-only（ADR-0002） | qa-lead | — |
| NFR-007 | 容量 | 不分頁（BR-027）、排序索引、FE-04 `DocumentFragment` 單次插入 | qa-lead | — |
| NFR-008 | 可安裝性 | OPS-01 `docker compose up`、`.env.example`、README 提供 Git Bash 與 PowerShell 兩種寫法 | qa-at | — |

## 孤兒檢查

T-0003 r1 補齊 UC 欄使前兩項成立；T-0004 r1 補齊模組與端點欄使第五項成立。Gate 1 的判準為孤兒檢查三項（US↔UC、US↔UC 反向、US↔模組／端點）為「無」，由 plan-ba 於 T-0005 重跑並定稿。

- 無對應 UC 的 US：**無**（13 則 US 全部有 UC，見上表 UC-ID 欄；來源 `docs/specs/02_系統分析書_SA.md` 第 1 章）。✅ 本項已成立且通過（T-0003 r1，plan-sa）。
- 無對應 US 的 UC：**無**（14 則 UC 全部標註對應 US，無憑空新增的使用案例）。✅ 本項已成立且通過（T-0003 r1，plan-sa）。
- **無對應模組／端點的 US：無**（13 則 US 的 `SD 模組` 欄全部已填；`API 端點` 欄亦無一為 `—`。US-008 與 US-012 的端點欄已註明其性質：US-008 為靜態頁無專屬 API 端點、US-012 的登出為用戶端清除憑證無端點，兩者皆非遺漏而是刻意設計，依據 Leader 裁決 O-004 與 O-006）。✅ 本項已成立且通過（T-0004 r1，plan-sd）。
- **無對應 US 的模組：無**（21 個模組全部可回溯到至少一則 US；基礎設施模組 BE-01／BE-03／BE-08 對應 US-009，認證與部署模組 BE-02／BE-07／OPS-01~04 對應 US-010）。✅ 本項已成立且通過（T-0004 r1，plan-sd）。
- 無對應 TC 的 US：本輪 13 則全部（TC 由測試團隊產出，尚未存在）。⏳ 尚未成立。
- 無對應 US 的 TC：本輪無 TC 可檢查。⏳ 尚未成立。
