---
id: T-0037
title: NFR-003 24 小時採樣判讀與測試總結 r3（Gate 2 r2 最終數字）
epic: E-001
team: qa
role: qa-lead
model: opus
phase: qa-staging
status: done
round: 1
depends_on: [T-0030, T-0031]
inputs:
  - docs/specs/06_部署架構與CICD.md#6.8.3（判讀指令與統計方式；uptime check 為主要來源）
  - docs/specs/06_部署架構與CICD.md#6.3（未達標時區分應用缺陷與平台事件）
  - docs/specs/06_部署架構與CICD.md#3.3（分母＝實際取樣次數）
  - docs/specs/07_測試計畫.md#4（退出準則 12 項）
  - docs/reports/20260919-1738-測試總結-E001-r2.md#1（退出準則表）、#4（殘留風險）、#5（建議與條件）、#7.1（上一輪 NFR-003 查詢）
  - docs/specs/24_缺陷清單.md
  - docs/specs/traceability.md（主表 TC-089 狀態欄）
  - tasks/E-001-todo-app.md（2026-09-19T18:11:54 與 18:18:59 兩段裁決：起算 17:55:07、TC-080 留補驗）
  - infra/uptime-check.sh（check id、gcloud 路徑、Git Bash 的 MSYS_NO_PATHCONV 注意事項）
outputs:
  - docs/reports/20260920-1806-測試總結-E001-r3.md
  - docs/specs/24_缺陷清單.md（僅在有新增或關閉缺陷時）
  - docs/specs/traceability.md（僅主表 TC-089 的「狀態」欄）
acceptance:
  - 依 06 §6.8.3 指令實跑 Cloud Monitoring `uptime_check/check_passed`，窗起點固定為起算時刻 2026-09-19T09:55:07Z（＝17:55:07+08:00），終點為判讀時刻（不早於 2026-09-20T09:55:07Z）；報告貼實際輸出摘要：各 checker_location 資料點數、true／false 數、總成功率（分母＝實際取樣次數）
  - 判定寫明：成功率 ≥ 99% → NFR-003 達標、TC-089 通過；未達標 → 依 06 §6.3／§6.8.3 規則區分「應用缺陷」與「平台事件／單一地區網路」，逐筆列出 false 的時間與地區，並於缺陷清單立案
  - 測試總結 r3 沿用 r2 表格：第 1、6 項更新為實際數字（第 1 項分母 105 重新分解，§1.1／§1.2／§4 R-1／§5 條件同步）；第 12 項與其餘項維持 r2 結論並註明「沿用 r2」
  - TC-080 直接比對本卡不執行（本 session 無 staging 憑證，agent 不索取），維持「部分通過」並保留為殘留風險與裁決事項；報告不得宣稱已補做
  - 建議明確：可發布／有條件可發布／不可發布 ＋ 殘留風險 ＋ 給 Leader 的裁決事項（每項五段式）
  - traceability.md 主表 TC-089「狀態」欄依判定更新；缺陷清單若有異動，D-編號連續
reviewer: leader
branch: null
created: 2026-09-20T18:03:00+08:00
updated: 2026-09-20T18:18:13+08:00
blocked_reason: null
---

## 目標

NFR-003 的 24 小時採樣窗已於 2026-09-20T17:55:07+08:00 走完。本卡以 Cloud Monitoring uptime check 的完整 24 小時資料判讀成功率，並出具測試總結 r3，給 Leader 撰寫 Gate 2 報告 r2、交使用者最終裁決所需的最終數字。

## 背景與限制

- 上游：T-0030 測試總結 r2（唯一硬阻擋＝NFR-003 時鐘未走完）；T-0031 已把 NFR-003 主要資料來源切換為 uptime check `todo-app-health-aMAlP5dfKv0`，起算 2026-09-19T17:55:07+08:00（Leader 裁決，見 Epic 2026-09-19T18:11:54）。GitHub `monitor-health.yml` cron 僅為備援，其 run 數不作為分母。
- 下游：Leader Gate 2 報告 r2（`docs/reports/20260920-HHmm-Gate2-E001-r2.md`）→ 使用者最終裁決。
- 必須遵守：CLAUDE.md「協作協定」與工作鐵則（Bash 不含單引號；Git Bash 呼叫 gcloud 加 `MSYS_NO_PATHCONV=1`；gcloud 用完整路徑）；角色檔 `.claude/agents/qa-lead.md`。
- 憑證規則：本卡只用 `gcloud auth print-access-token` 取得的短期 token 呼叫 Monitoring API，不讀取、不記錄任何 secret 值；不得索取 staging Basic Auth 或資料庫連線字串。TC-080 直接比對因此不在本卡範圍。
- 若判讀指令因 gcloud 未登入或 API 權限失敗，卡改 `blocked` 並在交接檔貼實際錯誤輸出，不得以估算數字代替。

## 驗收方式

Leader：

1. 重跑 06 §6.8.3 指令（同一窗）抽查總點數與 false 數，與報告 §7 貼的輸出一致。
2. 核對退出準則表第 1、6 項有實際數字且與 §7 輸出相符；第 1 項分母 105 的分解加總正確。
3. 核對 traceability.md 主表 TC-089 狀態與報告判定一致。
4. 建議段落存在且裁決事項為五段式。

```bash
# 抽查用（Git Bash）
GCLOUD="C:/Users/excal/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
TOKEN=$("$GCLOUD" auth print-access-token)
curl -sS -G "https://monitoring.googleapis.com/v3/projects/pj002-509106/timeSeries" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data-urlencode "filter=metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.check_id=\"todo-app-health-aMAlP5dfKv0\"" \
  --data-urlencode "interval.startTime=2026-09-19T09:55:07Z" \
  --data-urlencode "interval.endTime=2026-09-20T09:55:07Z" \
  --data-urlencode "view=FULL" | grep -c "boolValue"
```

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | leader | done | Leader 重跑同窗判讀（4 頁、6936 點、0 false、1156 輪、100%）與報告一致；6 條 acceptance 全過；假設 5 條全接受。裁決事項 A／B 交使用者（Gate 2 r2），C 採選項 1。註：抽查指令須跟 nextPageToken 取完分頁 | worklog/handoff/20260920-1813-T0037-r1-leader.md |
