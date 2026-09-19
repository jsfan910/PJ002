---
id: E-002
title: Phase 2：依 E-001 試跑發現修正框架（v1.1）
status: developing
owner: leader
created: 2026-09-19T18:16:31+08:00
updated: 2026-09-19T18:16:31+08:00
---

# E-002 框架修正 v1.1

## 目標

把 E-001 試跑一天內累積的 25 項發現，落實到角色檔、模板、skill、計畫書與 CLAUDE.md，讓下一個 Epic（或 E-001 P1）不再重踩。修正完成後以下一個 Epic 驗證。

## 發現清單（事實來源：tasks/E-001-todo-app.md 裁決紀錄、CLAUDE.md 工作鐵則、各卡交接檔）

| # | 發現 | 落點 | 卡 |
|---|---|---|---|
| F-01 | Bash 工具指令不可含 ASCII 單引號；python3 會卡住 | 角色檔共用「環境注意」段 | T-0032 |
| F-02 | 開發卡必須在 git worktree 作業；根目錄永遠 main | 角色檔、takeover／review-round skill、任務卡模板 | T-0032、T-0034、T-0033 |
| F-03 | agent 的 git 只准 append（禁 amend／reset／rebase／add -A） | 已在協定；角色檔環境段再列一次 | T-0032 |
| F-04 | 多行 commit 訊息一律寫檔再 -F | 角色檔環境段、handoff skill | T-0032、T-0034 |
| F-05 | .claude/agents 於 session 啟動時載入；同 session 新建定義需備援寫法 | leader.md、dispatch skill | T-0032、T-0034 |
| F-06 | Leader 派工提示詞與凍結規格衝突時（UUID 400／404、部署階段順序），執行者依規格優先是正確的 | 協定明文「規格優先於提示詞」；dispatch 提示詞只指向卡與規格、不重述規格 | T-0035、T-0034 |
| F-07 | Haiku 做 UAT 兩輪把瀏覽器認證快取問題誤判為阻擋；Sonnet 一次通過 | qa-uat 預設模型改 sonnet；qa-uat 角色檔加「先帶帳密載入、再用裸網址」程序與「阻擋須附網路面板證據」 | T-0032、T-0035 |
| F-08 | 多個 QA agent 平行對 staging 操作互相刪資料 | 測試計畫模板加「環境獨占時段／資料隔離」；qa-at／qa-uat 角色檔加「只動自己建立的資料」 | T-0033、T-0032 |
| F-09 | GitHub schedule cron 兩小時零次自動觸發，不可作為可用性採樣唯一來源 | 06 部署模板：採樣來源須有平台原生 uptime check；監控章節範例 | T-0033 |
| F-10 | PowerShell 管線會吃掉尾端換行，Format-Hex 看不出；Secret 值用檔案寫入；cmd 不認單引號；佔位符含尖括號 | dev-ops 角色檔「常見陷阱」；README 已有，模板 06 §4 加一句 | T-0032、T-0033 |
| F-11 | 憑證掃描四類已知假陽性 | CR 模板已加；qa-cr 角色檔引用 | T-0032 |
| F-12 | Leader 派工提示詞過長且重複（環境、回報格式、禁止事項） | 共用內容全部進角色檔；dispatch 提示詞固定三行 | T-0032、T-0034 |
| F-13 | 本機 Docker daemon 可能不可用；驗收要有離線備援 | dev-ops／dev-tl 角色檔：Docker 不可用時的替代驗證與註明方式 | T-0032 |
| F-14 | 第 2 輪即可升級模型（若失敗原因是工具操作而非能力） | 協定：Leader 裁量可於 r2 升級並記錄 | T-0035 |
| F-15 | 子代理自我輪詢背景工作反覆回報「等待中」 | 角色檔環境段：等待外部事件超過 2 次改回報 Leader，由 Leader 用 SendMessage 喚醒 | T-0032 |
| F-16 | dev-tl 初審把 /health 點節段繞過判非阻擋，qa-cr 判阻擋 | 保留雙層；dev-tl 角色檔加「安全邊界一律以 SD §6 判準，不以『第三方已擋』放行」 | T-0032 |
| F-17 | 任務卡缺 phase 欄，時程表需另維護 phaseById | 任務卡模板加 `phase:`；schedule-report 優先讀卡上 phase | T-0033、T-0034 |
| F-18 | Epic 檔沒有模板 | 新增 docs/templates/epic.md（目標、原始需求、範圍、限制、成功指標、任務卡表、Leader 裁決紀錄） | T-0033 |
| F-19 | 交接檔 A 段「開工時間：」格式不一致導致抽取失敗（T-0029 r1） | worklog 模板欄位標準化；handoff skill 收尾前驗證格式 | T-0033、T-0034 |
| F-20 | _done.md 需派工／完成時間供工時統計 | 已改；review-round skill 已含；模板補範例 | T-0033 |
| F-21 | Secret 以 latest 注入時首個 revision 解析錯值；建議釘版本 | 06 模板 §4 加「釘具體版本」建議與 verify 失敗自動重建 revision | T-0033 |
| F-22 | 測試團隊在 staging 未就緒時的「阻擋」記法有效 | 測試計畫模板固定寫法 | T-0033 |
| F-23 | Leader 手動介入基礎設施（update-secrets）要記錄在 Epic | leader.md：介入紀錄規則 | T-0032 |
| F-24 | 計畫書 Phase 定義與實際流程（Gate 2 24h 採樣、staging 補驗）需同步 | 計畫書 v1.1 | T-0035 |
| F-25 | 工作鐵則已累積 6 條，需整理分類 | CLAUDE.md 工作鐵則整理 | T-0035 |

## 任務卡

| 卡 | 範圍 | outputs |
|---|---|---|
| T-0032 | 12 個角色檔 | .claude/agents/*.md |
| T-0033 | 模板 | docs/templates/*（task_card、worklog_handoff、epic 新增、qa_07、spec_06、dev 相關） |
| T-0034 | skill | .claude/skills/{dispatch,handoff,review-round,takeover,schedule-report}/SKILL.md、scripts/gen-schedule.mjs（讀 phase） |
| T-0035 | 計畫書 v1.1、CLAUDE.md（協定、模型表、鐵則整理） | docs/團隊協作計畫書_20260919.md、CLAUDE.md |

四卡 outputs 不重疊，平行執行；reviewer 皆為 leader。

## Leader 裁決紀錄

- 2026-09-19T18:16:31+08:00：qa-uat 預設模型改 sonnet（平衡模式）；Phase 2 與 E-001 24 小時採樣平行進行。
- 2026-09-19T18:22:51+08:00：T-0033 review（552cc47）。裁決①新增檔（epic.md）不受淨增 ≤60 行限制；②`phase` 值域權威為 docs/templates/task_card.md 註解，gen-schedule.mjs 接受任意字串並以 phaseById／phaseByTeam 回退。Leader 審核待四卡到齊一併做。
