---
id: T-0039
title: 維運：部署改釘 Secret Manager 具體版本、verify 失敗自動重建 revision 重試一次
epic: E-001
team: dev
role: dev-ops
model: sonnet
phase: ops
status: done
round: 2
depends_on: []
inputs:
  - docs/specs/06_部署架構與CICD.md#6.7（建議一：釘具體版本；建議二：verify 失敗自動重試）
  - docs/specs/06_部署架構與CICD.md#3.2（deploy／verify 階段定義）
  - .github/workflows/deploy-staging.yml、scripts/deploy-staging.sh、infra/cloudrun-service.yaml（現行三處參數同步表見 README）
  - README.md（「部署與 secrets」章節、殼層陷阱補充）
  - CLAUDE.md#工作鐵則-安全（「Secret 以 latest 注入時首個 revision 可能解析到錯的值」）
outputs:
  - .github/workflows/deploy-staging.yml
  - scripts/deploy-staging.sh
  - infra/cloudrun-service.yaml
  - README.md（僅「部署與 secrets」章節與三處參數同步表）
  - docs/specs/06_部署架構與CICD.md（僅新增 §6.9 實作紀錄；§1～§6.8 文字不動，規格文字調整由 T-0040 plan-sd 負責）
acceptance:
  - deploy 階段先以 `gcloud secrets versions list --filter="state=ENABLED" --sort-by=~createTime --limit=1` 取得三個 secret 的最新啟用版本號，`--set-secrets` 改用 `NAME=secret:N`（不再用 `:latest`）；版本號寫入 `GITHUB_STEP_SUMMARY`；可選 repository variable 覆寫釘定版本（名稱與用途寫進 README，不含值）
  - verify（帶憑證呼叫 /api/v1/todos）失敗時，自動以相同參數重新 `gcloud run deploy` 一次、等新 revision 就緒後再驗證一次；仍失敗才判紅並輸出明確訊息；重試上限 1 次，且 STEP_SUMMARY 註明「已重試」
  - scripts/deploy-staging.sh 與 infra/cloudrun-service.yaml 與 workflow 三處參數一致（README 同步表更新）；yaml 以 `<SECRET_VERSION>` 佔位符表達
  - `bash -n scripts/deploy-staging.sh` 通過；workflow 以 `node -e` 讀檔確認為合法 YAML（或 `npx --yes yaml-lint`），貼輸出
  - 倉庫中不出現任何 secret 值；不執行 `gcloud secrets versions access`；交接檔貼 `gcloud secrets versions list` 只含版本號與狀態的輸出
  - 合併推送後由 dev-tl 確認 deploy-staging run 全綠且 STEP_SUMMARY 顯示三個版本號（此條由 dev-tl 於審核紀錄勾核）
reviewer: dev-tl
branch: task/T-0039-secret-pin-verify-retry
created: 2026-09-20T18:35:00+08:00
updated: 2026-09-20T20:22:00+08:00
blocked_reason: null
---

## 目標

落實 06 §6.7 兩項建議與 CLAUDE.md 安全鐵則：每次部署使用的 secret 版本明確可查、可回滾；一次性解析異常由工作流自動吸收，不再依賴使用者手動 Re-run。同時為 Gate 2 後的 staging 帳密輪換鋪路：使用者在 Secret Manager 加新版本後，下一次部署自動釘到最新啟用版本。

## 背景與限制

- 上游：T-0027 verify 401 事件（06 §6.7）；T-0031 維運卡；使用者 2026-09-20 Gate 2 r2 裁決③ A。
- 下游：T-0040（plan-sd 依本卡結果調整 06 規格文字）、T-0042（Release Notes）；使用者的帳密輪換（本卡不做輪換，只做機制）。
- 必須遵守：CLAUDE.md 協作協定與工作鐵則（PowerShell 管線陷阱、Git Bash 呼叫 gcloud 加 `MSYS_NO_PATHCONV=1`、Bash 不含單引號）；角色檔 `.claude/agents/dev-ops.md`；**在 git worktree `<根目錄>-wt/T-0039` 內作業**。
- 憑證規則：不讀取、不記錄任何 secret 值；只列版本號。
- **r2 追加（dev-tl 初審 r1 實測結論，2026-09-20 19:05）**：r1 已合併進 main（merge commit `05c9a1e`），但**真實 `deploy-staging` run `35506278351`（Deploy Staging #17，sha `6b27611`）紅燈**，第 8 步 `resolve secret versions` 以 exit code 1 失敗，`gcloud auth configure-docker` 起全部後續步驟 skipped。根因已實查確定：**部署用服務帳號 `github-deployer@pj002-509106.iam.gserviceaccount.com` 只有 `roles/artifactregistry.writer`／`roles/iam.serviceAccountUser`／`roles/run.admin`／`roles/secretmanager.secretAccessor` 四個角色，而 `roles/secretmanager.secretAccessor` 的 `includedPermissions` 只有 `resourcemanager.projects.get;resourcemanager.projects.list;secretmanager.versions.access`，不含 `gcloud secrets versions list` 所需的 `secretmanager.versions.list`（該權限在 `roles/secretmanager.viewer`）**。r1 的本機實測之所以通過，是因為本機 gcloud 用的是專案擁有者帳號，與 CI 的 WIF 服務帳號是**不同身分**——本機通過不能推論 CI 通過。r2 必須修的項目見「審核紀錄」r1 列。**r2 不需重建 worktree**（`...-wt/T-0039` 與分支 `task/T-0039-secret-pin-verify-retry` 均保留未清理），直接在原 worktree 續作、再由 dev-tl 合併一次。

## 驗收方式

dev-tl：

```bash
git diff --stat main...task/T-0039-secret-pin-verify-retry     # 只含 outputs
grep -n "secret:" .github/workflows/deploy-staging.yml            # 不得再出現 :latest
bash -n scripts/deploy-staging.sh
node -e "const f=require(\"fs\").readFileSync(\".github/workflows/deploy-staging.yml\",\"utf8\");console.log(f.split(\"\\n\").length,\"lines\")"
# 合併推送後：GitHub Actions deploy-staging 最新 run 全綠；STEP_SUMMARY 含三個版本號
```

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | dev-tl | rework | **離線 5 條 acceptance 全通過，第 6 條（真實 run 全綠＋STEP_SUMMARY 三個版本號）不通過。** 已合併 main（`05c9a1e`）並推送（`6b27611`），實際觸發的 `deploy-staging` run `35506278351` **紅燈**：第 8 步 `resolve secret versions（釘具體版本，不用 :latest）` exit code 1（check-runs annotations 只有 `Process completed with exit code 1.`，**沒有** workflow 內那句 `::error::無法解析 secret 版本…` 的 annotation，代表是 `gcloud secrets versions list` 自己回非 0、被 `set -euo pipefail` 直接中止，還沒走到自訂的空值檢查），後續 `gcloud auth configure-docker`／`migrate`／`docker build & push`／`gcloud run deploy ＋ verify`／`回填提示` 全部 skipped，STEP_SUMMARY 沒有任何版本號。根因實查：`gcloud projects get-iam-policy pj002-509106 --flatten="bindings[].members" --filter="bindings.members:github-deployer@…"` → 只有 `artifactregistry.writer`／`iam.serviceAccountUser`／`run.admin`／`secretmanager.secretAccessor`；`gcloud iam roles describe roles/secretmanager.secretAccessor --format="value(includedPermissions)"` → `resourcemanager.projects.get;resourcemanager.projects.list;secretmanager.versions.access`（**無 `secretmanager.versions.list`**），對照 `roles/secretmanager.viewer` 才含 `secretmanager.versions.list`。<br>**r2 具體要改的四件事**：<br>① `.github/workflows/deploy-staging.yml` 的 `resolve_version()`：**不要讓 `gcloud secrets versions list` 的非 0 直接被 `set -e` 吞掉**。改成先把 stdout＋stderr 收進變數再判斷，例如 `if ! out="$(gcloud secrets versions list "$secret_name" --filter=… --format="value(name)" 2>&1)"; then echo "::error::無法列出 secret ${secret_name} 的版本（原始訊息：${out}）。部署服務帳號需 roles/secretmanager.viewer（或含 secretmanager.versions.list 的自訂角色），或改以 repository variable SECRET_VERSION_* 指定版本號" >&2; return 1; fi`——失敗時必須留下可讀的 `::error::` annotation，而不是只有 `exit code 1`。<br>② `README.md`「部署與 secrets」建立服務帳號那段的角色迴圈（現為 `for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser roles/secretmanager.secretAccessor`，Bash 版與 PowerShell 版各一處）**補上 `roles/secretmanager.viewer`**，並在「釘定 Secret Manager 版本與 verify 自動重試」一節明寫「此機制需要 `secretmanager.versions.list` 權限；既有專案（角色是在 T-0039 之前建立的）必須補跑一次 `gcloud projects add-iam-policy-binding` 才會生效」。<br>③ 於 `06_部署架構與CICD.md` §6.9 補記此次 run `35506232750`→`35506278351` 的失敗事實與根因（不要只留 r1 那段「離線驗證通過」，那會變成第二份真相），並寫明「本機 gcloud 身分 ≠ CI 的 WIF 服務帳號身分，本機能列版本不代表 CI 能列」。<br>④ 交接檔「驗證方式」必須**額外**貼一條「以部署服務帳號的實際權限集合驗證」的證據（例如 `gcloud iam roles describe` ／ `get-iam-policy` 的輸出比對），不得再以本機擁有者帳號的 `versions list` 成功當作 CI 會成功的證據。<br>**IAM 變更屬使用者的雲端安全設定，agent 不代為執行**，需 Leader 轉請使用者授權（見交接檔「需要 Leader 裁決的事」）。<br>本輪不升級模型（r1 失敗屬「驗證設計把本機身分當成 CI 身分」的判準缺口，r2 已給出逐條具體修法，非工具操作類失敗）。 | `worklog/handoff/20260920-1848-T0039-r1-dev-tl.md` |
| r2 | dev-tl | blocked（非 rework：程式碼已通過初審並合併，卡在使用者側 IAM 授權） | **離線 acceptance 1～5 全通過，第 6 條（真實 run 全綠＋STEP_SUMMARY 三個版本號）不通過，但不通過的原因已確認完全在本卡程式碼之外。** 我獨立重跑（不採信交接檔文字）：`git diff --stat main...` 僅 6 檔＝outputs＋任務卡＋r2 交接檔；`grep -n "secret:" .github/workflows/deploy-staging.yml` 零命中（殘留的 `latest` 三處經逐行確認皆為 docker image tag `${IMAGE}:latest` 與註解文字，非 secret 參照）；`bash -n scripts/deploy-staging.sh` → `SYNTAX_OK`；`node -e` 讀檔 → `268 lines`；`npx --yes yaml-lint .github/workflows/deploy-staging.yml infra/cloudrun-service.yaml` → `√ YAML Lint successful.`；`infra/cloudrun-service.yaml` 三處 `secretKeyRef.key` 確為 `"<SECRET_VERSION>"` 佔位符且附查版本號指令，與 workflow／腳本的 `NAME=secret:N` 三處一致，README 同步表與 Variables 表已更新；倉庫無任何 secret 值，`grep -rn "versions access"` 只命中 README 既有的 T-0027 量測範例（本卡 diff 未新增），本輪我自己也未執行 `gcloud secrets versions access`。<br>**r1 四項修法逐條驗證**：①**已修且經我獨立重現**——我以 `sed -n "/^          resolve_version() {/,/^          }$/p"` 從 workflow **原檔**抽出函式（22 行，避免手抄失真）、放一支 mock `gcloud` 到 PATH，跑四條路徑：`PERMISSION_DENIED` → 印出完整 `::error::無法列出 secret database-url 的版本（gcloud 原始訊息：…）…` 且 `EXIT=1`；無 ENABLED 版本 → 印出 `::error::secret database-url 沒有任何 state=ENABLED 的版本…` 且 `EXIT=1`；正常 → 回傳版本號 `EXIT=0`；override 分支 → 不呼叫 gcloud 直接回 `42`。r1 的「黑盒 exit 1」確已消除。②**已修**——README Bash 與 PowerShell 兩處角色迴圈都含 `roles/secretmanager.viewer`，「前置權限（必讀）」子段寫明補跑指令、`PERMISSION_DENIED` 後果與「IAM 屬使用者雲端安全設定、不由 agent 代執行」。③**已修**——06 新增 §6.9.1，保留 §6.9 的「離線驗證通過」未覆蓋，追記 run `35506278351` 紅燈事實、兩組 IAM 實查輸出與「本機 gcloud 身分 ≠ CI 的 WIF 服務帳號身分」教訓。④**已做**——r2 交接檔第 4 組貼了服務帳號實際角色集合，不再拿本機擁有者帳號的成功當 CI 會成功的證據。交接檔「假設與決策」五條我**全部接受**：`scripts/deploy-staging.sh` 同步修法是 acceptance 第 3 條「三處一致」的必要延伸而非擴大範圍；`infra/cloudrun-service.yaml` 零改動正確（靜態範本、不含 gcloud 呼叫、與 r1 失敗無因果）；未用 `versions access` 二次確認符合安全鐵則；README 的 `gcloud.cmd` 屬同段落最小修正；不推翻 r1 兩項決策符合 Leader `54e8117` 裁決。<br>**合併與推送（已執行）**：`git merge --no-ff task/T-0039-secret-pin-verify-retry` → merge commit `3345022`；CHANGELOG 追加 T-0039 r2 一列；推送 `617a32f..bfe4693 main -> main`。合併後 `git diff task/T-0039-secret-pin-verify-retry main -- <四個 outputs>` 為空，確認 main 內容與分支一致。<br>**真實 run 結果（acceptance 第 6 條，不通過）**：`bfe4693` 觸發 CI #18 成功 → `deploy-staging` run **`35507519302`**（job `106069733881`）**紅燈**。步驟明細：1～7（`checkout`／`setup-node`／`npm ci`／`npm run build`／`auth（WIF）`／`setup-gcloud`）全 success，第 8 步 `resolve secret versions（釘具體版本，不用 :latest）` **failure**，第 9～13 步全 `skipped`，`GITHUB_STEP_SUMMARY` 無任何版本號。**但這次的失敗形態與 r1 有本質差異**：`check-runs/106069733881/annotations` 除了 `Process completed with exit code 1.` 之外，**多出一則 `annotation_level: failure` 的可讀訊息**：`無法列出 secret database-url 的版本（gcloud 原始訊息：ERROR: (gcloud.secrets.versions.list) PERMISSION_DENIED: Permission 'secretmanager.versions.list' denied on resource (or it may not exist). …）`——r1 時**只有** exit code、沒有任何原因。**r2 要修的東西確實修好了，且已在真實 CI 上得到驗證**。<br>**判定 blocked 而非 rework 的理由**：剩餘唯一阻擋項是雲端 IAM 授權，屬使用者的雲端專案安全設定，依 CLAUDE.md 安全鐵則 agent 不代為執行；本卡程式碼本身無可再改之處（再改也不會讓沒有 `secretmanager.versions.list` 的服務帳號列得出版本）。我以唯讀指令複驗 IAM 現況（未執行任何變更）：`gcloud projects get-iam-policy pj002-509106 --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:github-deployer@pj002-509106.iam.gserviceaccount.com"` → 仍只有 `roles/artifactregistry.writer`／`roles/iam.serviceAccountUser`／`roles/run.admin`／`roles/secretmanager.secretAccessor` 四列；`gcloud iam roles describe roles/secretmanager.secretAccessor` → `resourcemanager.projects.get;resourcemanager.projects.list;secretmanager.versions.access`；`roles/secretmanager.viewer` → 含 `secretmanager.versions.list`。另以唯讀的 `gcloud secrets versions list <secret> --format="table(name,state)"` 確認三個 secret 目前 ENABLED 最新版本分別為 `database-url`→`1`、`basic-auth-user`→`3`、`basic-auth-pass`→`1`（只取版本號與狀態，未讀值），可供使用者走 (b) 路徑時直接填入。<br>**程式已合併於 main**：merge commit `3345022`、推送後 HEAD `bfe4693`。**worktree `…-wt/T-0039` 與分支 `task/T-0039-secret-pin-verify-retry` 保留不清理**，待使用者完成授權後重跑 deploy-staging 勾核 acceptance 第 6 條。**待使用者擇一**：(a) `gcloud projects add-iam-policy-binding pj002-509106 --member="serviceAccount:github-deployer@pj002-509106.iam.gserviceaccount.com" --role="roles/secretmanager.viewer"`；(b) 設 repository variables `SECRET_VERSION_DATABASE_URL=1`／`SECRET_VERSION_BASIC_AUTH_USER=3`／`SECRET_VERSION_BASIC_AUTH_PASS=1`（只填版本號，不填值）。**不升級模型**（r2 產出已達標，阻擋點不在能力）。 | `worklog/handoff/20260920-1915-T0039-r2-dev-tl.md` |
| r2（授權後複驗） | dev-tl | **done** | **acceptance 第 6 條已勾核通過，本卡六條全數通過，status 由 blocked 轉 done。** 使用者已對 `github-deployer@pj002-509106.iam.gserviceaccount.com` 補授 `roles/secretmanager.viewer`；我以唯讀指令複驗（未執行任何 IAM 變更）：`gcloud projects get-iam-policy pj002-509106 --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:github-deployer@…"` → 現為五列，較 r2 時多出 `roles/secretmanager.viewer`。<br>**重跑方式**：`gh` CLI 本機未安裝（`gh : The term "gh" is not recognized…`），無法 `gh run rerun`，改以**空 commit** `854c843`（訊息已註明用途與 gh 不可用之事實）推送 `5a3599d..854c843 main -> main` 觸發 CI #21 → workflow_run 觸發 Deploy Staging。<br>**結果（全綠）**：run **`35509795862`**（Deploy Staging #21，job `106075596373`，sha `854c843`，耗時 1m39s）`conclusion=success`。13 個步驟全 `success`，含 r1／r2 兩度失敗的第 8 步 `resolve secret versions（釘具體版本，不用 :latest）`；annotations 只剩 1 warning（Node 20 deprecation）＋1 notice（ubuntu-latest 遷移），**無任何 failure annotation**。對照組：同日 19:58 授權前的 run `35509297796`（#20，sha `5a3599d`）仍在第 8 步紅燈，annotation 為 `PERMISSION_DENIED: Permission "secretmanager.versions.list" denied…`——**授權是唯一變數，前後對照成立**。<br>**新 revision 與釘定版本（實查，僅版本號、未讀值）**：`gcloud run revisions list --service=todo-app --region=asia-east1` → 新增 **`todo-app-00017-qg4`**（2026-09-20T12:10:28Z，前一版為 09-19 的 `todo-app-00016-tsg`）；`gcloud run revisions describe todo-app-00017-qg4` 的 env 顯示三個 `secretKeyRef` 分別為 `database-url` key `1`、`basic-auth-user` key `3`、`basic-auth-pass` key `1`——**皆為具體數字版本、無 `latest`**，且與 r2 記錄的三個 secret ENABLED 最新版本（1／3／1）完全一致。<br>**STEP_SUMMARY 取證方式與限制（誠實揭露）**：GitHub job summary 對**未登入訪客不渲染**（run 頁 `document.body.innerText` 無 `database-url` 字樣、頁面顯示 `Sign in`），logs REST endpoint 匿名回 **403**，`gh` 未安裝，而本角色不得處理任何憑證登入，故**無法直接貼出 STEP_SUMMARY 的渲染文字**。改以等價且更接近事實源的兩段證據勾核：①產生該表格的第 8 步本身 `success`，而該步驟是 summary 表格的唯一寫入者，且 r2 已用 mock `gcloud` 證明任一 secret 解析失敗或版本為空時該步驟必回非 0；②該步驟算出的三個版本號**實際被綁進 revision `00017-qg4`**（上一段 `describe` 輸出），即 summary 表格的三個值等同 `1`／`3`／`1`。<br>**staging 實測（部署後）**：`GET /health` → **200**（body `{"status":"ok"}`）、`GET /`（未帶憑證）→ **401**、`GET /api/v1/todos`（未帶憑證）→ **401**。另依 dev-tl 安全判準實打豁免路徑變體：`/./health` 302、`/%2e/health` 302、`/health/` 401、`/HEALTH` 401、`/health/../` 302、`//health` 200（回的是 health 本身）；並反向確認受保護資源無法經變體取得：`//api/v1/todos` 401、`//` 401、`/./api/v1/todos` 302、`/health/../api/v1/todos` 302、`/%2e%2e/api/v1/todos` 302——**無任一變體可繞過保護，無阻擋級**。<br>**清理**：分支 `task/T-0039-secret-pin-verify-retry` 經 `git branch --merged main` 確認已完全併入 main、worktree `…-wt/T-0039` `git status --short` 為空，遂以 `git worktree remove`＋`git branch -d`＋`git worktree prune` 清理（**未用 `--force`／`-D`**）。 | `worklog/handoff/20260920-2006-T0039-r2-dev-tl.md` |
