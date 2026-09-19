---
doc: TRACE
title: 追溯矩陣
epic: E-001
version: 0.2
status: approved       # Gate 1 通過；TC 欄由 qa-lead 於 T-0009 填實，NFR「對應測試」欄與主表「狀態」欄由 qa-lead 於 T-0019 依 Leader 裁決補填；主表「狀態」欄於 T-0023 改寫為**測試結果**（2026-09-19）
author: plan-ba
reviewers: [leader, qa-lead]
updated: 2026-09-19T07:45:48+08:00
---

# 追溯矩陣：E-001 待辦事項 Web 應用

DoD：無孤兒需求（每個 US 至少一個 UC、一個模組、一個測試案例）；無孤兒測試（每個 TC 對應一個 US）。

**本檔目前狀態（T-0019 後）：主表八欄全部定稿** —— `US-ID`、`US 標題`、`優先級`、`UC-ID`、`SD 模組`、`API 端點` 六欄由 plan-ba 於 T-0005 r1 反向核對定稿；`TC-ID` 欄由 qa-lead 於 T-0009 r1 填實；`狀態` 欄與下方「非功能需求追溯」表的 `對應測試` 欄由 qa-lead 於 **T-0019** 依 Leader 裁決（2026-09-19T07:40:06+08:00 對 T-0009 的裁決第 1、2 項）補填。**無未定稿欄位。**
**T-0023（2026-09-19）**：主表 `狀態` 欄由「定稿狀態」改寫為 **Gate 2 的測試結果**（本機／staging 分列）。逐 TC 的通過證據見 `docs/reports/` 的 CR／AT／UAT 三組報告與 `docs/reports/20260919-1356-測試總結-E001.md`；缺陷見 `docs/specs/24_缺陷清單.md`。
欄位填寫責任：`UC-ID` 由 plan-sa（T-0003）補 —— **已於 2026-09-19 完成**，來源 `docs/specs/02_系統分析書_SA.md` 第 1 章；`SD 模組`、`API 端點` 由 plan-sd（T-0004）補 —— **已於 2026-09-19 完成**，來源 `docs/specs/03_系統設計書_SD.md` 第 3 章模組表與第 5 章 API 摘要、`docs/specs/04_API規格.yaml`；**`TC-ID` 由 qa-lead 於測試計畫卡（T-0009 r1）填實**，來源 `docs/specs/20_測試案例.md`（本檔不代填，也不得以空白推論為「無對應」）。
plan-ba 已於 T-0005 r1 反向審核覆蓋度並定稿，審核過程與證據見 `docs/reports/20260919-0637-覆蓋度審核-E001.md`。
未填欄位一律標 `—`（待補），不得留空以免誤判為「已確認無對應」。

模組編號規則：`BE-xx` 後端、`FE-xx` 前端、`OPS-xx` DevOps，定義見 SD 第 3.1 ~ 3.3 節。

| US-ID | US 標題 | 優先級 | UC-ID | SD 模組 | API 端點 | TC-ID | 狀態 |
|---|---|---|---|---|---|---|---|
| US-001 | 新增待辦 | P0 | UC-001 | BE-04、BE-05、BE-06、FE-02、FE-03、FE-04 | `POST /api/v1/todos` | TC-001 ~ TC-011、TC-088、TC-096 | P0 全 TC 通過（本機）；無 staging 依存 TC（T-0023） |
| US-002 | 檢視待辦清單 | P0 | UC-002 | BE-04、BE-05、BE-06、FE-02、FE-03、FE-04 | `GET /api/v1/todos` | TC-012 ~ TC-018、TC-093、TC-094、TC-097 | P0 全 TC 通過（本機）；TC-093 為 NFR-006 本機近似、TC-094 容量 502 筆通過（T-0023） |
| US-003 | 編輯待辦 | P0 | UC-003 | BE-04、BE-05、BE-06、FE-03、FE-04 | `PATCH /api/v1/todos/{todoId}` | TC-019 ~ TC-029、TC-098 | P0 全 TC 通過（本機）；無 staging 依存 TC（T-0023） |
| US-004 | 刪除待辦 | P0 | UC-004 | BE-04、BE-05、BE-06、FE-03、FE-04 | `DELETE /api/v1/todos/{todoId}` | TC-030 ~ TC-037、TC-099 | P0 全 TC 通過（本機）；無 staging 依存 TC（T-0023） |
| US-005 | 切換完成／未完成 | P0 | UC-005 | BE-04、BE-05、BE-06、FE-03、FE-04 | `PATCH /api/v1/todos/{todoId}`（設定目標狀態，冪等，O-002） | TC-038 ~ TC-047、TC-100 | P0 全 TC 通過（本機）；無 staging 依存 TC（T-0023） |
| US-006 | 依狀態篩選 | P0 | UC-006 | BE-04、BE-05、BE-06、FE-03、FE-04 | `GET /api/v1/todos?status=all\|active\|completed`（篩選在後端，O-003） | TC-048 ~ TC-058、TC-101 | P0 全 TC 通過（本機）；無 staging 依存 TC（T-0023） |
| US-007 | 顯示建立時間 | P0 | UC-007 | BE-04、BE-06、FE-04 | `GET /api/v1/todos`、`GET /api/v1/todos/{todoId}`（回應的 `createdAt` 欄位） | TC-059 ~ TC-064、TC-102 | P0 全 TC 通過（本機）；無 staging 依存 TC（T-0023） |
| US-008 | 單頁前端操作 | P0 | UC-008 | BE-09、FE-01、FE-02、FE-03、FE-04 | `GET /`、`GET /assets/*`（靜態頁；本 US 無專屬 API 端點） | TC-065 ~ TC-069、TC-091、TC-103 | P0 TC 通過（本機）；**TC-091 相容性 4／6 組通過**（Chromium、Edge 各 2 尺寸過；Firefox 2 組阻擋：工具／環境限制，Leader 裁決列 Gate 2 後補跑）（T-0023） |
| US-009 | REST API | P0 | UC-009 | BE-01、BE-03、BE-04、BE-05、BE-06 | 全部 `/api/v1/*` 端點 ＋ 統一錯誤物件（`components/schemas/Error`） | TC-070 ~ TC-077、TC-085 ~ TC-087、TC-092、TC-104 | P0 全 TC 通過（本機）；NFR-001 P95 GET 47.7ms／寫入 4.5~7.8ms 皆達標（T-0023） |
| US-010 | staging 部署 | P0 | UC-010、UC-011 | BE-02、BE-07、BE-08、OPS-01、OPS-02、OPS-03、OPS-04 | `GET /health`（**唯一未保護路徑**，O-005） | TC-078 ~ TC-084、TC-089、TC-090、TC-095、TC-105 | **TC-082／083／095 通過（本機）；staging 依存 8 條阻擋（環境未就緒）**：TC-078、079、080、081（僅本機段過）、084、089、090、105。**staging 尚未部署，不得以本機結果代表 staging**（T-0023） |
| US-011 | 使用者註冊 | P1 | UC-012 | BE-10、BE-11、BE-12 | `POST /api/v1/auth/register` | TC-106 ~ TC-111（Gate 2 後） | P1：未執行（Gate 2 後），不列入 Gate 2 門檻（T-0023） |
| US-012 | 使用者登入與登出 | P1 | UC-013 | BE-10、BE-11、BE-13 | `POST /api/v1/auth/login`（登出為用戶端清除 JWT，**無端點**，O-006） | TC-112 ~ TC-117（Gate 2 後） | P1：未執行（Gate 2 後），不列入 Gate 2 門檻（T-0023） |
| US-013 | 使用者資料隔離 | P1 | UC-014 | BE-13、BE-05、BE-06、BE-12 | 全部 `/api/v1/todos*` 端點（JWT 授權橫切；跨使用者回 404，O-001） | TC-118 ~ TC-123（Gate 2 後） | P1：未執行（Gate 2 後），不列入 Gate 2 門檻（T-0023） |

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

`設計對策` 欄由 plan-sd 於 T-0004 補（完整內容見 `docs/specs/03_系統設計書_SD.md` 第 7 章，此處只列落點）；`對應測試` 欄與主表 `TC-ID` 欄同由 qa-lead 填（plan-ba 不代填）：**已於 T-0019 依 Leader 裁決（對 T-0009 的裁決第 1 項）補填**，來源為 `docs/specs/20_測試案例.md` 第 8 章「NFR → TC 覆蓋對照」，八條 NFR 各至少一條可量測案例。

| NFR-ID | 類別 | 設計對策落點（SD 第 7 章） | 驗證責任 | 對應測試 |
|---|---|---|---|---|
| NFR-001 | 效能 | BE-01 連線池、BE-06 索引 `(created_at DESC, id DESC)`、OPS-04 監測兼保溫；量測**先暖身 10 秒** | qa-lead（負載測試） | TC-085、TC-086 |
| NFR-002 | 安全 | HTTPS 由 Cloud Run 終止並將 HTTP 301 導向 HTTPS（ADR-0005）、BE-03 剝除內部細節、FE-04 全面 `textContent`、ADR-0004 不啟用 CORS | qa-cr + qa-lead | TC-079、TC-087、TC-088、TC-110、TC-116 |
| NFR-003 | 可用性 | BE-07 `/health` 豁免且不查 DB、Cloud Run revision 零停機切流量、OPS-04 每 5 分鐘取樣 3 次；**Gate 2 採 24 小時**（O-009） | dev-ops + qa-lead | TC-089、TC-090 |
| NFR-004 | 相容性 | FE-01 無框架、ES2020、flexbox 單一斷點、最小點擊區 44×44 | qa-at | TC-091 |
| NFR-005 | 可維運性 | BE-03 唯一錯誤出口、pino `reqId` 與回應 `requestId` **為同一值** | qa-cr | TC-092 |
| NFR-006 | 資料持久性 | **由架構保證**：Neon 與運算實例分離；migration forward-only（ADR-0002） | qa-lead | TC-093 |
| NFR-007 | 容量 | 不分頁（BR-027）、排序索引、FE-04 `DocumentFragment` 單次插入 | qa-lead | TC-094 |
| NFR-008 | 可安裝性 | OPS-01 `docker compose up`、`.env.example`、README 提供 Git Bash 與 PowerShell 兩種寫法 | qa-at | TC-095 |

## 孤兒檢查

T-0003 r1 補齊 UC 欄使前兩項成立；T-0004 r1 補齊模組與端點欄使第三、四項成立。Gate 1 的判準為孤兒檢查三項（US↔UC、UC↔US 反向、US↔模組／端點）為「無」。
**本節四項已由 plan-ba 於 T-0005 r1 重跑指令後定稿**，實際輸出見 `worklog/handoff/20260919-0637-T0005-r1-plan-ba.md` B 段「驗證方式」與 `docs/reports/20260919-0637-覆蓋度審核-E001.md`。

| # | 檢查項 | T-0005 r1 重跑結果 | 判定 |
|---|---|---|---|
| 1 | **無對應 UC 的 US** | **無**。13 則 US 的 `UC-ID` 欄全數有實值，無一為 `—`；且 SRS 第 3 章的 US 集合與本表 US 集合 `diff` 為空（`US-SET-IDENTICAL-OK`） | ✅ 通過（T-0005 r1 重跑確認） |
| 2 | **無對應 US 的 UC** | **無**。SA 第 1 章的 14 則 UC 與本表引用的 UC 集合 `diff` 為空（`UC-SET-IDENTICAL-OK`），無憑空新增的使用案例 | ✅ 通過（T-0005 r1 重跑確認） |
| 3 | **無對應模組／端點的 US** | **無**。13 則 US 的 `SD 模組` 與 `API 端點` 兩欄皆無一為空或 `—`；進一步以 SD 第 3 章「對應 UC」欄反查（範圍寫法 `UC-00a~UC-00b` 已展開），**13 則 US 全部至少有一個模組明載其 UC，缺口數 0** | ✅ 通過（T-0005 r1 重跑確認） |
| 4 | **無對應 US 的模組** | **無**。SD 第 3 章定義 21 個模組，本表引用 21 個，`comm` 雙向差集皆為空（既無捏造模組，亦無孤兒模組） | ✅ 通過（T-0005 r1 重跑確認） |
| 5 | **無對應 TC 的 US** | **無**。13 則 US 的 `TC-ID` 欄全數有實值，無一為 `—`（`grep -c "^| US-.*—" ` 結果為 0）。逐則對照：US-001 十三條、US-002 十條、US-003 十二條、US-004 九條、US-005 十一條、US-006 十二條、US-007 七條、US-008 七條、US-009 十三條、US-010 十一條、US-011 六條、US-012 六條、US-013 六條，合計 123 條 | ✅ 通過（T-0009 r1 由 qa-lead 填實後重跑確認） |
| 6 | **無對應 US 的 TC** | **無**。`docs/specs/20_測試案例.md` 的 TC 集合（TC-001 ~ TC-123，`grep -cE "^\| TC-[0-9]{3} "` = 123）與本表 `TC-ID` 欄展開後的集合 `diff` 為空（`TC-SET-IDENTICAL-OK`）；每個 TC 恰好被一則 US 引用，無重複引用、無孤兒 TC | ✅ 通過（T-0009 r1 由 qa-lead 填實後重跑確認） |

**Gate 1 判準（孤兒檢查三項）結論：第 1、2、3 項皆為「無」，第 4 項為附加檢查亦為「無」。四項全數通過。**

補充說明（供接手者判讀，非缺口）：
- US-008 的 `API 端點` 欄為 `GET /`、`GET /assets/*`（靜態頁），**刻意不在 `04_API規格.yaml` 中**；OpenAPI 描述的是 API 契約，靜態頁由 `BE-09 static-hosting` 供應，其落點在 SD 第 5 章端點表第 2 列。非遺漏。
- US-012 的登出**無端點**（Leader 裁決 O-006：登出＝用戶端清除 JWT）。非遺漏。
- US-013／UC-014 為**橫切授權**而非獨立端點，端點落點為全部 `/api/v1/todos*`，模組落點為 `BE-05`／`BE-13`。惟 `04_API規格.yaml` 的 operation description 尚未標註 UC-014（其餘 12 則有端點的 UC 皆有標註），屬**文字標註瑕疵，非設計缺口**，已列入 `docs/reports/20260919-0637-覆蓋度審核-E001.md`「對 SD 的修正建議」交 plan-sd。

## T-0005 r1 定稿註記：本表與 SD 的一致性核對

plan-ba 反向核對的四組一致性，全部相符（指令與輸出見交接檔 B 段）：

| 核對組 | 方法 | 結果 |
|---|---|---|
| US 集合 | SRS 第 3 章 `### US-0xx` 標題 vs 本表主表第 1 欄 | 完全一致，13 則 |
| 優先級 | SRS 第 3 章標題的 `（P0/P1）` vs 本表 `優先級` 欄 | 13 列逐列相符（P0 十則、P1 三則） |
| UC 集合 | SA 全檔 `UC-0xx` vs 本表全檔 `UC-0xx` | 完全一致，14 則 |
| 模組集合 | SD 第 3 章模組表 vs 本表引用 | 雙向差集皆空，21 個 |
| API 路徑 | 本表引用的路徑 vs `04_API規格.yaml` 的 `paths` | 本表引用 5 條路徑，yaml 定義 5 條，完全相符 |
| AC 數量 | SRS 實際 `AC-0xx-n` 去重計數 vs 下方「驗收條件對照」表 | 13 列全部相符，合計 62 條 |
| 特殊驗證 AC | 本表「特殊驗證方式的 AC」表 5 條 vs SRS 與 Leader 裁決 | 5 條的 AC-ID 皆存在於 SRS；SRS 中僅有的 2 條「二擇一值」AC（AC-009-3 的「200 或 204」、AC-013-2 的「404 或 403」）**均已被本表收斂**，無漏收斂者 |

已知的寬窄差異（**非缺口，不影響 Gate 1，供 plan-sd 日後維護時對齊**）：本表為 6 則 US 列出的模組比 SD 第 3 章「對應 UC」欄所明載的更寬 —— US-001／003／005／006 多列 `FE-04`（任何異動後都要重繪清單，BR-011）、US-008 多列 `FE-02`／`FE-03`（單頁的組成部分）、US-009 多列 `BE-05`／`BE-06`（REST API 的業務層與資料層）、US-013 多列 `BE-06`／`BE-12`。方向皆為「本表較寬」，即**不存在任何 US 的覆蓋不足**。
