---
id: T-0045
title: 維運事故：staging 流量自 09-19 回滾演練後釘死在 todo-app-00003-lt2，15 個新 revision 從未接流量；復原、修 pipeline 驗證、重測部署不可用時間
epic: E-001
team: dev
role: dev-ops
model: sonnet
phase: ops
status: review
round: 1
depends_on: []
inputs:
  - tasks/E-001-todo-app.md（Leader 2026-09-20 20:41 事故裁決段：實查輸出 spec.traffic 100% → todo-app-00003-lt2、latestCreatedRevisionName todo-app-00018-xq4）
  - scripts/rollback-staging.sh（`update-traffic --to-revisions <rev>=100` 會把流量釘死；演練後未還原）
  - docs/specs/06_部署架構與CICD.md#5.1、#5.4（回滾流程與 09-19 演練紀錄）、#3.2（deploy＋verify 單一步驟）、#6.9（T-0039 實作紀錄）
  - .github/workflows/deploy-staging.yml、scripts/deploy-staging.sh（現行 deploy 後只驗 service URL，未驗新 revision 是否接到流量）
  - scripts/measure-deploy-downtime.sh（T-0031 的 /health 輪詢量測腳本）
  - docs/specs/20_測試案例.md#TC-090（部署不可用時間 < 60 秒）
outputs:
  - .github/workflows/deploy-staging.yml
  - scripts/deploy-staging.sh
  - scripts/rollback-staging.sh（新增 `--to-latest` 還原模式與演練後必還原的提示）
  - README.md（僅「部署與 secrets」章節下回滾／還原小節）
  - docs/specs/06_部署架構與CICD.md（僅新增 §6.10 事故紀錄與量測結果；§5.1 規格文字修正留 plan-sd）
  - docs/reports/20260920-HHmm-流量釘死事故-E001.md（事故報告：發現經過、影響範圍、復原、量測、pipeline 修正）
acceptance:
  - 先量測再復原：背景啟動 `scripts/measure-deploy-downtime.sh`（≥ 180 秒、1 秒一次）後執行 `gcloud run services update-traffic todo-app --region asia-east1 --to-latest`，貼 `services describe --format="yaml(spec.traffic,status.traffic,status.latestReadyRevisionName)"` 前後輸出：復原後 100% 流量在 latestReady（預期 todo-app-00018-xq4），並貼量測結果（最長連續非 200 秒數）
  - deploy-staging.yml 與 scripts/deploy-staging.sh：deploy 後讀 `status.latestCreatedRevisionName` 與 `status.traffic`，若新 revision 未拿到 100% 流量則自動 `update-traffic --to-latest` 並重新 verify；STEP_SUMMARY 記錄「新 revision 名稱、流量百分比」；流量仍不在新 revision 即 `::error::` 判紅。verify 改為同時確認 `latestReadyRevisionName == 接流量的 revision`
  - scripts/rollback-staging.sh 新增 `--to-latest` 模式與檔頭警語「以 --to-revisions 回滾後，之後的 deploy 不會自動切流量，演練結束或修好後必須 --to-latest 還原」；README 同步
  - 復原後以空 commit 推送 main 觸發一次真實部署，背景輪詢 /health 全程，貼：run 全綠、STEP_SUMMARY 的 revision 與流量、最長連續非 200 秒數（TC-090 重測，門檻 < 60 秒）
  - 06 §6.10：事故時間軸（09-19 16:4x 演練 `--to-revisions 00003-lt2=100` → 15 個 revision 未接流量 → 09-20 20:4x 發現）、影響範圍（staging 一直服務 00003-lt2 映像；T-0031 的「revision 00008 切換 0 秒」量測無效；T-0038／T-0043 未上線）、復原與兩次量測、pipeline 修法；事故報告同內容並含給 qa-lead 的清單（哪些 staging 結論仍有效：跑在 00003-lt2 上的 P0 功能與 NFR-003；哪些需重驗：TC-090、TC-080 直接比對、D-017、TC-009 favicon）
  - 不讀取、不輸出任何 secret 值；只 add outputs
reviewer: dev-tl
branch: task/T-0045-traffic-pinned-fix
created: 2026-09-20T20:41:00+08:00
updated: 2026-09-20T21:26:24+08:00
blocked_reason: null
---

## 目標

staging 自 2026-09-19 回滾演練後，`spec.traffic` 被釘在 todo-app-00003-lt2，之後 15 次部署（含 T-0039 釘版本、T-0038 D-017 修正、T-0043 favicon、v0.1.0）建立的 revision 都沒有接到流量；deploy-staging 的 verify 只打 service URL，因此每次都「全綠」。本卡：復原流量、讓 pipeline 從此驗證「新 revision 真的在服務」、重測 TC-090，並把事故寫成可追溯的紀錄。

## 背景與限制

- 上游：Leader 於使用者 staging 重跑 D-017 時發現（msedge 報 /favicon.ico 404、chromium 環境問題），實查 `services describe` 得 spec.traffic → 00003-lt2。
- 下游：qa-lead 測試總結 r4（重驗清單、立 D-018 pipeline 缺陷）；使用者重跑 D-017；plan-sd 修 06 §5.1 規格文字（P1 規格同步卡）。
- 必須遵守：CLAUDE.md 協作協定與工作鐵則；角色檔 `.claude/agents/dev-ops.md`；**在 git worktree `<根目錄>-wt/T-0045` 內作業**；gcloud 用完整路徑、Git Bash 加 `MSYS_NO_PATHCONV=1`。
- `update-traffic --to-latest` 是可逆的服務層操作（不是 IAM／安全設定），agent 可執行；先量測再切，切完立刻驗 /health。
- 注意 dev-tl 正在合併 T-0044（CHANGELOG／06 §6.1.1／§6.3／§6.9.1）；本卡只新增 §6.10，合併時由 dev-tl 處理相鄰段落衝突。

## 驗收方式

dev-tl：

```bash
GCLOUD="C:/Users/excal/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
MSYS_NO_PATHCONV=1 "$GCLOUD" run services describe todo-app --region asia-east1 --project pj002-509106 --format="yaml(spec.traffic,status.traffic,status.latestReadyRevisionName,status.latestCreatedRevisionName)"
# 預期：spec.traffic 為 latestRevision: true 或指向最新 revision；status.traffic 100% 在 latestReady
grep -n "to-latest\|latestCreatedRevisionName\|traffic" .github/workflows/deploy-staging.yml scripts/deploy-staging.sh scripts/rollback-staging.sh | head -20
# 真實部署 run：STEP_SUMMARY 含 revision 名稱與 100%；量測輸出最長連續非 200 < 60 秒
git diff --stat main...task/T-0045-traffic-pinned-fix   # 只含 outputs
```

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| | | | | |
