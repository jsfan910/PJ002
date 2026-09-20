#!/usr/bin/env bash
# scripts/rollback-staging.sh（T-0018，OPS-03，06_部署架構與CICD.md §5.1；
# --to-latest 還原模式為 T-0045 事故修法新增）
#
# Cloud Run revision 切流量回滾的本機等效（Git Bash 可執行）。目標 < 2 分鐘。
# 不重新建置、不重新拉映像、不重啟資料庫連線以外的任何東西。
#
# ⚠️ 重要警語（T-0045 事故教訓，2026-09-20）：
# 以 `--to-revisions <rev>=100` 回滾後，Cloud Run 的 spec.traffic 會從
# 「一律跟隨最新 revision（latestRevision: true）」變成「明確釘死在該具名
# revision」。**之後的 `gcloud run deploy` 不會自動把流量切回新 revision**，
# 即使新 revision 成功建立並通過 startup probe 也一樣——deploy-staging 的
# verify 只打 service URL（同一網址不論流量指到哪個 revision 都會回應），
# 所以每次部署仍會「全綠」，但實際上使用者一直在用被釘死的舊版本。
# 09-19 的回滾演練就是這樣：演練後忘了還原，15 次後續部署（含真正的功能
# 修正）都沒有真正上線，直到 09-20 才被發現。
#
# **演練結束或問題排除後，務必執行本腳本的 `--to-latest` 模式還原**，
# 把 spec.traffic 改回「一律跟隨最新 revision」，之後的 deploy 才會恢復
# 自動切流量。deploy-staging.yml／scripts/deploy-staging.sh 自 T-0045 起
# 已會在每次部署後自動偵測並修正這個狀況，但那是「事後補救」，本腳本的
# `--to-latest` 才是「演練後立刻歸位」的正確流程，兩者不互相取代。
#
# 前置需求：已 `gcloud auth login`；已 export GCP_RUN_SERVICE、GCP_REGION、
# STAGING_BASIC_AUTH_USER、STAGING_BASIC_AUTH_PASSWORD、STAGING_BASE_URL。
#
# 用法：
#   1) 不帶參數：列出目前 revision 與流量分佈，供人判讀選哪一版回滾。
#      bash scripts/rollback-staging.sh
#   2) 帶一個參數（目標 revision 名稱）：把 100% 流量切回該 revision 並驗證。
#      **執行本模式即代表流量從此被明確釘死，演練結束或問題排除後
#      必須執行模式 3 還原，不得就此放著不管。**
#      bash scripts/rollback-staging.sh todo-app-00007-abc
#   3) 帶 `--to-latest`：把流量還原為「一律跟隨最新 revision」（解除釘死）。
#      演練結束、或確認流量已被釘死（模式 1 的清單與 status.traffic 不含
#      `latestRevision: true`）時，一律用這個模式歸位。
#      bash scripts/rollback-staging.sh --to-latest

set -euo pipefail

for v in GCP_RUN_SERVICE GCP_REGION; do
  if [ -z "${!v:-}" ]; then
    echo "缺少環境變數：$v" >&2
    exit 1
  fi
done

verify_service() {
  if [ -n "${STAGING_BASE_URL:-}" ]; then
    echo ""
    echo "== 驗證 1/3：/health =="
    curl -fsS "${STAGING_BASE_URL}/health"
    echo ""

    if [ -n "${STAGING_BASIC_AUTH_USER:-}" ] && [ -n "${STAGING_BASIC_AUTH_PASSWORD:-}" ]; then
      echo "== 驗證 2/3：/api/v1/todos（帶憑證，資料筆數應與切換前一致） =="
      curl -fsS -u "${STAGING_BASIC_AUTH_USER}:${STAGING_BASIC_AUTH_PASSWORD}" "${STAGING_BASE_URL}/api/v1/todos"
      echo ""
    fi

    echo "== 驗證 3/3：連續 3 次確認沒有持續的 5xx =="
    for i in 1 2 3; do
      curl -sSI "${STAGING_BASE_URL}/health" | head -1
    done
  fi
}

echo "== 目前 revision 清單（找最後一次已知良好的版本） =="
gcloud run revisions list --service "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" \
  --format="table(metadata.name, status.conditions[0].lastTransitionTime, spec.containers[0].image)"

ARG1="${1:-}"

if [ "${ARG1}" = "--to-latest" ]; then
  echo ""
  echo "== 還原流量為「一律跟隨最新 revision」（解除釘死） =="
  gcloud run services update-traffic "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" --to-latest

  echo ""
  echo "== 確認流量分佈已生效（預期 latestRevision: true，percent: 100） =="
  gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" \
    --format="yaml(spec.traffic,status.traffic,status.latestReadyRevisionName,status.latestCreatedRevisionName)"

  verify_service

  echo ""
  echo "還原完成：流量已改回一律跟隨最新 revision，之後的 gcloud run deploy 會自動切流量。"
  exit 0
fi

TARGET_REVISION="${ARG1}"
if [ -z "${TARGET_REVISION}" ]; then
  echo ""
  echo "未帶參數，只列出清單。若要執行回滾或還原："
  echo "  bash scripts/rollback-staging.sh <revision-name>   # 切到指定 revision（會釘死流量，見檔頭警語）"
  echo "  bash scripts/rollback-staging.sh --to-latest       # 還原為一律跟隨最新 revision"
  exit 0
fi

echo ""
echo "== 把 100% 流量切回 ${TARGET_REVISION}（此後流量將被明確釘死於此 revision） =="
gcloud run services update-traffic "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" \
  --to-revisions "${TARGET_REVISION}=100"

echo ""
echo "== 確認流量分佈已生效 =="
gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" \
  --format="value(status.traffic)"

verify_service

echo ""
echo "回滾指令已完成。請於 docs/reports/ 或缺陷單記錄：回滾時間、revision 名稱與 commit SHA、觸發原因、不可用時長（06 §5.1 第 5 點）。"
echo ""
echo "⚠️ 提醒：流量目前已被明確釘死在 ${TARGET_REVISION}，之後的 gcloud run deploy 不會自動切流量（T-0045 事故教訓）。"
echo "   演練結束或問題排除後，務必執行：bash scripts/rollback-staging.sh --to-latest"
