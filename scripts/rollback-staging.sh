#!/usr/bin/env bash
# scripts/rollback-staging.sh（T-0018，OPS-03，06_部署架構與CICD.md §5.1）
#
# Cloud Run revision 切流量回滾的本機等效（Git Bash 可執行）。目標 < 2 分鐘。
# 不重新建置、不重新拉映像、不重啟資料庫連線以外的任何東西。
#
# 前置需求：已 `gcloud auth login`；已 export GCP_RUN_SERVICE、GCP_REGION、
# STAGING_BASIC_AUTH_USER、STAGING_BASIC_AUTH_PASSWORD、STAGING_BASE_URL。
#
# 用法：
#   1) 不帶參數：列出目前 revision 與流量分佈，供人判讀選哪一版回滾。
#      bash scripts/rollback-staging.sh
#   2) 帶一個參數（目標 revision 名稱）：把 100% 流量切回該 revision 並驗證。
#      bash scripts/rollback-staging.sh todo-app-00007-abc

set -euo pipefail

for v in GCP_RUN_SERVICE GCP_REGION; do
  if [ -z "${!v:-}" ]; then
    echo "缺少環境變數：$v" >&2
    exit 1
  fi
done

echo "== 目前 revision 清單（找最後一次已知良好的版本） =="
gcloud run revisions list --service "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" \
  --format="table(metadata.name, status.conditions[0].lastTransitionTime, spec.containers[0].image)"

TARGET_REVISION="${1:-}"
if [ -z "${TARGET_REVISION}" ]; then
  echo ""
  echo "未帶目標 revision 參數，只列出清單。若要執行回滾："
  echo "  bash scripts/rollback-staging.sh <revision-name>"
  exit 0
fi

echo ""
echo "== 把 100% 流量切回 ${TARGET_REVISION} =="
gcloud run services update-traffic "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" \
  --to-revisions "${TARGET_REVISION}=100"

echo ""
echo "== 確認流量分佈已生效 =="
gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" \
  --format="value(status.traffic)"

if [ -n "${STAGING_BASE_URL:-}" ]; then
  echo ""
  echo "== 驗證 1/3：/health =="
  curl -fsS "${STAGING_BASE_URL}/health"
  echo ""

  if [ -n "${STAGING_BASIC_AUTH_USER:-}" ] && [ -n "${STAGING_BASIC_AUTH_PASSWORD:-}" ]; then
    echo "== 驗證 2/3：/api/v1/todos（帶憑證，資料筆數應與回滾前一致） =="
    curl -fsS -u "${STAGING_BASIC_AUTH_USER}:${STAGING_BASIC_AUTH_PASSWORD}" "${STAGING_BASE_URL}/api/v1/todos"
    echo ""
  fi

  echo "== 驗證 3/3：連續 3 次確認沒有持續的 5xx =="
  for i in 1 2 3; do
    curl -sSI "${STAGING_BASE_URL}/health" | head -1
  done
fi

echo ""
echo "回滾指令已完成。請於 docs/reports/ 或缺陷單記錄：回滾時間、revision 名稱與 commit SHA、觸發原因、不可用時長（06 §5.1 第 5 點）。"
