---
id: T-0044
title: 維運：第二個 uptime check（真備援）＋ uptime 告警政策；06 §6.1.1／§6.9.1 回填
epic: E-001
team: dev
role: dev-ops
model: sonnet
phase: ops
status: rework
round: 2
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
updated: 2026-09-20T20:44:18+08:00
blocked_reason: null
---

## 目標

讓 NFR-003 的量測來源不再是單點、且失敗時真的有人會知道：第二個 uptime check 作為真備援，加上 uptime 告警政策；通知管道的 email 由使用者自行綁定。順帶把 06 的兩處「待補」回填成事實。

## 背景與限制

- 上游：T-0037 裁決事項 C → T-0040 §6.1.1 三選項 → Leader 採 A＋告警；T-0039 部署已綠（revision todo-app-00017-qg4）。
- 下游：qa-lead 下一輪測試總結第 6 項的量測來源說明；P1。
- 必須遵守：CLAUDE.md 協作協定與工作鐵則（Git Bash 呼叫 gcloud 加 `MSYS_NO_PATHCONV=1`、gcloud 用完整路徑、Bash 不含單引號）；角色檔 `.claude/agents/dev-ops.md`；**在 git worktree `<根目錄>-wt/T-0044` 內作業**（雖以 infra／docs 為主，仍依開發卡規則走分支）。
- 建立監控資源屬使用者 GCP 專案內的可逆操作（可 delete），不屬 IAM／安全設定，agent 可執行；通知管道涉及個人 email，由使用者自行建立。

- **r2 追加（Leader 2026-09-20 20:42）**：outputs 放寬一行——准改 06 §3.3 第 181 行「待 Leader 裁決：要不要建第二個 uptime check」為「已採選項 A（T-0044），見 §6.1.1」；其餘 §1～§6.1 仍不動。r1 退回原因是「宣稱做了但沒做」（政策 documentation.content 實為中文），r2 依 dev-tl 審核紀錄的修法(甲)：改文件敘述與交接檔三處，使其與雲端實際內容一致，不必動雲端資源；重跑 describe 兩組作證。

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
| r1 | dev-tl | rework | **acceptance 1／2／3／5 通過，第 4 條不通過。** 全程以唯讀 `list`／`describe` 重跑（未建立／修改／刪除任何雲端資源、未建通知管道、未執行 `gcloud secrets versions access`）。**通過的部分**：①backup check `todo-app-health-backup-yvjsI-2xna0` 經 `monitoring uptime describe` 逐項勾核 —— `useSsl: true`／`port: 443`／`path: /health`／`statusValue: 200`／`period: "300s"`／`timeout: "10s"`／`selectedRegions: ASIA_PACIFIC,SOUTH_AMERICA,USA_VIRGINIA`（與主 check 的 ASIA_PACIFIC/USA_OREGON/USA_IOWA/EUROPE 完全不重疊，含 asia-pacific＋兩個非亞太地區）。②告警政策 `8479925612924794663` 經 `alpha monitoring policies describe` 確認 `combiner: OR`、兩條 `conditionThreshold` 的 filter 各釘 `check_id="todo-app-health-aMAlP5dfKv0"` 與 `check_id="todo-app-health-backup-yvjsI-2xna0"`（對兩個 check 皆生效）、`REDUCE_COUNT_FALSE`＋`alignmentPeriod: 600s`＋`COMPARISON_GT`＋`trigger.count: 1`、`enabled: true`，且**輸出無 `notificationChannels` 欄位＝未綁任何管道**；README 新小節三步指令完整、佔位符 `<YOUR_EMAIL>`／`<PROJECT_ID>`／`<CHANNEL_NAME>` 皆含角括號並註明整串替換，**全文零實際 email**。③我自行重跑新的 10 分鐘窗（12:25:39Z~12:35:39Z，非採信交接檔的舊窗）：主 check true 45／false 0、4 個 checker_location；backup check true **36**／false 0、3 個 checker_location（`apac-singapore`／`sa-brazil-sao_paulo`／`usa-virginia` 均已回報），兩者 `nextPageToken` 皆不存在＝無分頁遺漏。⑤全 diff 掃 `versions access`／`password`／`BASIC_AUTH_PASS=`／`DATABASE_URL=postgres`／`@ep-`／`AIza`／`-----BEGIN`，唯一命中是交接檔自述「未讀取 secret」那句話本身；§6.1.1 明載「費用估計維持 US$0」並附額度換算。變更範圍亦通過：`git diff --stat main...` 僅 5 檔＝outputs 三檔＋任務卡＋交接檔，06 僅 4 個 hunk（frontmatter／§6.1.1／§6.3／§6.9.1），**未觸及 §1～§6.1 本文與 §6.4～§6.8**；§6.9.1 追記含 run `35509795862`、revision `todo-app-00017-qg4`、三版本號 `database-url:1`／`basic-auth-user:3`／`basic-auth-pass:1`。<br>**第 4 條不通過的唯一原因 —— 規格寫入了一項與實際雲端資源相反的事實**：06 §6.1.1（約第 338 行）與 `infra/uptime-check.sh`（第 32、126、134 行）宣稱告警政策的 `documentation.content`「**刻意只用英文／ASCII**」。我實測相反：`describe` 讀回的 content 是**中文**，且 GCP 端儲存的是**正確的 UTF-8**（加 `PYTHONUTF8=1 PYTHONIOENCODING=utf-8` 讀回為完整中文句「任一 todo-app uptime check（todo-app-health 或 todo-app-health-backup）在 10 分鐘窗內出現失敗取樣時觸發…」；未設時為位元組 `3f3f`＝字面 `?`，那只是**本機 gcloud 讀出路徑的有損轉碼，不是雲端資料損壞**）。更關鍵：政策的 `creationRecord.mutateTime` 與 `mutationRecord.mutateTime` **同為 `2026-09-20T12:21:57.131375314Z`，代表建立後從未被更新**，亦即交接檔所稱「改為政策 JSON 一律用英文／ASCII 撰寫」這個動作**實際上從未發生**。`infra/uptime-check.sh` 自身也自相矛盾：第 144 行 `describe-alert-policy` 分支已帶 `PYTHONUTF8=1 PYTHONIOENCODING=utf-8`，若內容真只有 ASCII 則這兩個變數毫無必要。<br>**r2 具體要改哪裡（三處文字，採修法(甲)則完全不需動雲端資源）**：<br>①**`docs/specs/06_部署架構與CICD.md` §6.1.1 約第 338 行**「告警政策」bullet 末句：刪除「政策 JSON 的 `documentation.content` 刻意只用英文／ASCII」，改為事實——「documentation.content 為**中文**，GCP 端儲存為正確 UTF-8；**讀回必須加 `PYTHONUTF8=1 PYTHONIOENCODING=utf-8`**，否則本機 Windows gcloud 會顯示字面 `?`（`0x3f`），那是本機讀出路徑的有損轉碼、**不是雲端資料損壞，不要據此重建或刪除政策**；`infra/uptime-check.sh describe-alert-policy` 已內建這兩個變數」。（替代修法(乙)：實際執行 `gcloud alpha monitoring policies update <policy> --update-policy-from-file=<英文 JSON>` 讓文字成真，並貼出 `mutationRecord.mutateTime` 已變動的 describe 為證。二擇一，但三處必須一致。）<br>②**`infra/uptime-check.sh` 開頭註解第 32～34 行**：「本檔的告警政策 JSON 一律只用英文／ASCII，避免此問題」與事實不符且與第 144 行自相矛盾；改為說明既有政策 documentation 為中文、GCP 端正確、讀回需帶那兩個環境變數。若要保留「日後新建政策建議用英文」的前瞻建議，必須與「既有政策現況」分成兩句寫清楚，不可混為一句陳述。<br>③**`infra/uptime-check.sh` 第 126 行與第 134 行**（`內容只用英文／ASCII`、`務必只用英文/ASCII`）：作為「日後新建時的建議」可保留，但須與②改寫後一致，不得再讓讀者推論「現有政策是英文的」。<br>④**dev-ops 自行更正 r1 交接檔**（`worklog/handoff/20260920-2019-T0044-r1-dev-ops.md`，由產生者自己改，dev-tl 不代改）：B 段「完成事項」第 3 點、「假設與決策」第 4 點、「驗證方式」第 5 組結語共三處「最終政策改用純英文 documentation／不代表最終政策內容含中文」皆與事實相反，須改為實況並附一次 UTF-8 環境變數下的 describe 輸出為證。<br>**對交接檔「假設與決策」5 條表態**：第 1（地區組合完全不重疊）、第 2（`thresholdValue: 0` 敏感門檻，誤報代價已由 §6.3／§6.8.3 判讀規則吸收且未綁通知管道）、第 3（兩 condition 放同一政策 OR，只開一個 incident，化解選項 A 代價②）、第 5（不動 §6.1 主表，遵守任務卡禁改區）——**四條接受**；第 4（documentation 改用純英文）——**不接受，該決策從未被執行**。<br>**未合併、未更新 CHANGELOG、未推送 main**；worktree `…-wt/T-0044` 與分支 `task/T-0044-uptime-backup-alert` **保留供 r2 續作**。<br>**本輪不升級模型（維持 sonnet）**：r1 產出方向、資源設定、門檻設計、文件結構皆正確，失敗僅在一句「宣稱做了但沒做」的陳述，非能力不足亦非規格理解錯；修法已逐行給定。<br>**另提 Leader 裁決（不阻擋本卡）**：06 §3.3 第 181 行仍寫「待 Leader 裁決：要不要建第二個 uptime check…」，已成過期事實，但該行位於任務卡明文禁改的 §1～§6.1 區內，dev-ops 不動它是對的；建議 r2 派工時明文放寬 outputs 准修這一行。 | `worklog/handoff/20260920-2033-T0044-r1-dev-tl.md` |
