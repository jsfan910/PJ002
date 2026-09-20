---
id: T-0039
title: 維運：部署改釘 Secret Manager 具體版本、verify 失敗自動重建 revision 重試一次
epic: E-001
team: dev
role: dev-ops
model: sonnet
phase: ops
status: review
round: 1
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
updated: 2026-09-20T18:45:27+08:00
blocked_reason: null
---

## 目標

落實 06 §6.7 兩項建議與 CLAUDE.md 安全鐵則：每次部署使用的 secret 版本明確可查、可回滾；一次性解析異常由工作流自動吸收，不再依賴使用者手動 Re-run。同時為 Gate 2 後的 staging 帳密輪換鋪路：使用者在 Secret Manager 加新版本後，下一次部署自動釘到最新啟用版本。

## 背景與限制

- 上游：T-0027 verify 401 事件（06 §6.7）；T-0031 維運卡；使用者 2026-09-20 Gate 2 r2 裁決③ A。
- 下游：T-0040（plan-sd 依本卡結果調整 06 規格文字）、T-0042（Release Notes）；使用者的帳密輪換（本卡不做輪換，只做機制）。
- 必須遵守：CLAUDE.md 協作協定與工作鐵則（PowerShell 管線陷阱、Git Bash 呼叫 gcloud 加 `MSYS_NO_PATHCONV=1`、Bash 不含單引號）；角色檔 `.claude/agents/dev-ops.md`；**在 git worktree `<根目錄>-wt/T-0039` 內作業**。
- 憑證規則：不讀取、不記錄任何 secret 值；只列版本號。

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
| | | | | |
