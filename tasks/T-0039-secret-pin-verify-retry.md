---
id: T-0039
title: 維運：部署改釘 Secret Manager 具體版本、verify 失敗自動重建 revision 重試一次
epic: E-001
team: dev
role: dev-ops
model: sonnet
phase: ops
status: rework
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
updated: 2026-09-20T19:05:00+08:00
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
