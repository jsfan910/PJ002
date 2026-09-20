---
id: T-0044
title: 維運：第二個 uptime check（真備援）＋ uptime 告警政策；06 §6.1.1／§6.9.1 回填
epic: E-001
team: dev
role: dev-ops
model: sonnet
phase: ops
status: todo
round: 1
depends_on: [T-0039, T-0040]
inputs:
  - docs/specs/06_部署架構與CICD.md#6.1.1（備援缺口三選項；Leader 2026-09-20 19:37 採選項 A 並加告警政策）
  - docs/specs/06_部署架構與CICD.md#6.3（告警條與 T-0040 更正「等同沒有自動告警」）
  - docs/specs/06_部署架構與CICD.md#6.8.3（現有 check todo-app-health-aMAlP5dfKv0 的建立指令與判讀指令）
  - infra/uptime-check.sh（現有 check 的 create／list／describe 用法、MSYS_NO_PATHCONV 注意事項）
  - worklog/handoff/20260920-2006-T0039-r2-dev-tl.md（run 35509795862 全綠、revision todo-app-00017-qg4 釘定版本的事實，供 §6.9.1 追記）
  - README.md（「部署與 secrets」章節結構，告警通知管道步驟放此）
outputs:
  - infra/uptime-check.sh（新增 backup check 的 create／list／describe 與 alert 政策指令；記錄實際建立的 check id 與 policy id）
  - docs/specs/06_部署架構與CICD.md（僅 §6.1.1 回填「已採選項 A」與實際 id、§6.3 告警條更新、§6.9.1 追記 IAM 授權後 run 35509795862 成功事實；不動其他章節）
  - README.md（僅新增「告警通知管道（使用者一次性設定）」小節）
acceptance:
  - 實際建立第二個 uptime check `todo-app-health-backup`：https、443、path /health、status 200、period 5 分鐘、timeout 10s、檢查地區與現有 check 不同組合（至少含 asia-pacific 與一個非亞太地區）；貼 `gcloud monitoring uptime describe` 輸出（含 name）
  - 實際建立告警政策：條件為 uptime check 失敗（任一 check 於 10 分鐘窗內失敗比例達門檻或連續失敗），對兩個 check 皆生效；政策不綁通知管道亦可建立，貼 `gcloud alpha monitoring policies list` 或 describe 輸出（含 name）；README 寫明使用者一次性建立 email 通知管道並綁定的指令（agent 不填入任何 email）
  - 兩個 check 建立後，以 06 §6.8.3 判讀指令（含分頁）各抽 10 分鐘窗確認皆有 true 資料點，貼輸出
  - 06 §6.1.1 由「待 Leader 裁決」改為「已採選項 A（T-0044）」並填 id；§6.3 告警條更新為新政策的實際行為；§6.9.1 追記成功事實（run id、revision、三個版本號）；不動 §1～§6.1、§6.4～§6.8 文字
  - 不讀取、不輸出任何 secret 值；費用估計仍為 US$0（uptime check 免費額度、告警政策免費）並寫進 §6.1.1
reviewer: dev-tl
branch: task/T-0044-uptime-backup-alert
created: 2026-09-20T20:25:00+08:00
updated: 2026-09-20T20:25:00+08:00
blocked_reason: null
---

## 目標

讓 NFR-003 的量測來源不再是單點、且失敗時真的有人會知道：第二個 uptime check 作為真備援，加上 uptime 告警政策；通知管道的 email 由使用者自行綁定。順帶把 06 的兩處「待補」回填成事實。

## 背景與限制

- 上游：T-0037 裁決事項 C → T-0040 §6.1.1 三選項 → Leader 採 A＋告警；T-0039 部署已綠（revision todo-app-00017-qg4）。
- 下游：qa-lead 下一輪測試總結第 6 項的量測來源說明；P1。
- 必須遵守：CLAUDE.md 協作協定與工作鐵則（Git Bash 呼叫 gcloud 加 `MSYS_NO_PATHCONV=1`、gcloud 用完整路徑、Bash 不含單引號）；角色檔 `.claude/agents/dev-ops.md`；**在 git worktree `<根目錄>-wt/T-0044` 內作業**（雖以 infra／docs 為主，仍依開發卡規則走分支）。
- 建立監控資源屬使用者 GCP 專案內的可逆操作（可 delete），不屬 IAM／安全設定，agent 可執行；通知管道涉及個人 email，由使用者自行建立。

## 驗收方式

dev-tl：

```bash
GCLOUD="C:/Users/excal/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
"$GCLOUD" monitoring uptime list-configs --format="table(name,displayName,period,selectedRegions.list())"   # 兩個 check
"$GCLOUD" alpha monitoring policies list --format="table(name,displayName,enabled)"                          # 新政策
grep -n "6.1.1\|已採選項 A\|todo-app-health-backup" docs/specs/06_部署架構與CICD.md | head
git diff --stat main...task/T-0044-uptime-backup-alert   # 只含 outputs 三檔
```

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| | | | | |
