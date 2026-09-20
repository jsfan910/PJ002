---
id: T-0045
title: 維運事故：staging 流量自 09-19 回滾演練後釘死在 todo-app-00003-lt2，15 個新 revision 從未接流量；復原、修 pipeline 驗證、重測部署不可用時間
epic: E-001
team: dev
role: dev-ops
model: sonnet
phase: ops
status: done
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
updated: 2026-09-20T21:31:49+08:00
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
| r1（第一階段・離線） | dev-tl | 退回後修正 | **阻擋級 2 項**。**R-1 流量判準用錯欄位**：判定式為 `latestReadyRevisionName == latestCreatedRevisionName`，`status.traffic` 不參與判定、「100%」從未被檢查；審核者實查 `run revisions list` 得 `00004`～`00018` 全部 `Ready=True`，與 dev-ops 貼出的「釘死期該欄位停在 `00003-lt2`」並存，證實此欄位行為與 Knative 公開語義不同，屬平台未文件化行為，不得作為規格級判準，且分流／canary（50/50）情境會漏判。要求改為主判準讀 `status.traffic`（`csv[no-heading]`，`table` 格式帶方括號無法解析）加總目標 revision 百分比要求 =100，`latestReadyRevisionName` 降為併行輔助條件，STEP_SUMMARY 改填實際值，06／README 六處措辭同步。**R-2 文件結構破壞**：插入 §6.10 時刪除了 `## 7. 三處必須同步的參數表（T-0025，CR S-9）` 整章標題與分隔線，參數表被併吞進 §6.10。dev-ops 於 `78dca59` 兩項皆修正；複審以 awk 三情境實測（正常 100→放行、事故重演 0→擋、分流 50/50→50→**擋**，最後一項正是原判準會誤放行者）與真實服務端對端實跑 PASS 佐證有效，合併為 `5b28b13` | `worklog/handoff/20260920-2059-T0045-r1-dev-tl.md`（A／B／B2 段） |
| r1（第二階段・真實部署） | dev-tl | **done** | acceptance 六條全數達成。獨立唯讀複驗：GitHub API 匿名讀 run `35513187463` 得 `conclusion=success`、`head_sha=95bc4ca`，13 個步驟全 success；核對 `95bc4ca` 上的 `deploy-staging.yml` 判定式確為 `[ "${pct}" = "100" ] && ...`，**證實此次 CI 跑的是 R-1 修正後的判準，且 WIF 服務帳號有權執行新增的 `describe --format=csv` 呼叫**（解除 r1 所列「修正後邏輯未經 CI 實測」之風險）；`services describe` 得 100% 流量在 `todo-app-00019-k5q`、`latestReady == latestCreated`，csv 判準複跑得 `todo-app-00019-k5q,100`，`/health` 實打 `HTTP 200`；revision `00019-k5q` 建立於 `13:21:55Z` 落在 deploy 步驟 `13:21:50Z～13:22:19Z` 時窗內；量測窗 `13:17:39Z～13:22:38Z` 涵蓋 run 全程 `13:20:01Z～13:22:23Z`，226/226 樣本皆 200、最長連續非 200 = 0 秒，遠低於 60 秒門檻。job log 因匿名 API 回 403 需登入，審核者依安全鐵則未索取憑證，改以上述證據鏈佐證。**非阻擋級殘留**：06 第 717／791／843 行三處交叉引用仍寫「待補」，指向已補完的 §6.10.3；兩份給 qa-lead 的正式重驗清單（06 §6.10.4、事故報告）皆已正確標為「已重驗，通過」，下游不受誤導，列入 plan-sd P1 規格同步卡順修。合併為 `f015ea1`（見 CHANGELOG） | `worklog/handoff/20260920-2059-T0045-r1-dev-tl.md`（B3 段） |
