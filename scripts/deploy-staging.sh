#!/usr/bin/env bash
# scripts/deploy-staging.sh（T-0018，OPS-03；secret 釘版本為 T-0039，06 §6.7 建議一）
#
# .github/workflows/deploy-staging.yml 的本機等效（Git Bash 可執行）。
# 供使用者在取得 GCP 專案與 gcloud 登入後，於本機手動重現一次部署
# （NFR-008「未參與者 15 分鐘內...可重現一次 staging 部署」）。
# 階段順序與 workflow 完全一致：auth 前置 → migrate → build & push → deploy → verify。
#
# T-0039：--set-secrets 改用具體版本號（不再用 :latest），版本號預設取
# 「該 secret 目前狀態為 ENABLED 的最新版本」，可用下列環境變數覆寫釘定
# 版本（與 workflow 的 repository variables 同名概念，值不進版控）：
#   SECRET_VERSION_DATABASE_URL SECRET_VERSION_BASIC_AUTH_USER
#   SECRET_VERSION_BASIC_AUTH_PASS
# 本檔為人工手動執行的本機腳本，失敗時由使用者自行判斷是否重跑；
# 06 §6.7 建議二的自動重試僅在 CI workflow 內實作（重跑本檔本身即等同
# 人工重試，不再另外內建自動重試迴圈）。
#
# 前置需求（使用者自行完成，agent 不索取、不代填）：
#   - 已執行 `gcloud auth login` 或已有 Application Default Credentials
#   - 已 export 下列環境變數（值不寫入本檔、不進版控）：
#       GCP_PROJECT_ID GCP_REGION GCP_AR_REPOSITORY GCP_RUN_SERVICE
#       NEON_DATABASE_URL STAGING_BASIC_AUTH_USER STAGING_BASIC_AUTH_PASSWORD
#   - 選填（覆寫釘定版本，不填則自動取最新 ENABLED 版本）：
#       SECRET_VERSION_DATABASE_URL SECRET_VERSION_BASIC_AUTH_USER
#       SECRET_VERSION_BASIC_AUTH_PASS
#
# 用法：
#   Git Bash:   bash scripts/deploy-staging.sh

set -euo pipefail

REQUIRED_VARS=(GCP_PROJECT_ID GCP_REGION GCP_AR_REPOSITORY GCP_RUN_SERVICE \
  NEON_DATABASE_URL STAGING_BASIC_AUTH_USER STAGING_BASIC_AUTH_PASSWORD)
missing=()
for v in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!v:-}" ]; then
    missing+=("$v")
  fi
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "缺少環境變數：${missing[*]}（請先 export，值不得寫入任何檔案）" >&2
  exit 1
fi

IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_AR_REPOSITORY}/todo-app"
SHA="$(git rev-parse HEAD)"

# T-0039 r2：與 deploy-staging.yml 同步修正——不讓 `gcloud secrets versions
# list` 的非 0 結束碼被 set -e 直接吞掉、只留「exit code 1」看不出原因。
# 顯式捕捉 stdout+stderr 再判斷，失敗時輸出可讀訊息（含 gcloud 原始錯誤
# 與修復指引）再 return 1；呼叫端用 `|| exit 1` 承接。
resolve_version() {
  local secret_name="$1"
  local override="$2"
  if [ -n "${override}" ]; then
    echo "${override}"
    return 0
  fi
  local out
  if ! out="$(gcloud secrets versions list "${secret_name}" \
    --filter="state=ENABLED" \
    --sort-by="~createTime" \
    --limit=1 \
    --format="value(name)" 2>&1)"; then
    echo "無法列出 secret ${secret_name} 的版本（gcloud 原始訊息：${out}）。請確認已 gcloud auth login 且該帳號有 secretmanager.viewer（或等效）權限；也可能是 secret 尚未建立。若暫時無法調整權限，可改用對應的 SECRET_VERSION_DATABASE_URL／SECRET_VERSION_BASIC_AUTH_USER／SECRET_VERSION_BASIC_AUTH_PASS 環境變數直接指定版本號略過此查詢" >&2
    return 1
  fi
  if [ -z "${out}" ]; then
    echo "secret ${secret_name} 沒有任何 state=ENABLED 的版本，請先在 Secret Manager 建立至少一個版本" >&2
    return 1
  fi
  echo "${out}"
}

echo "== auth =="
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

echo "== resolve secret versions（釘具體版本，不用 :latest） =="
DB_VERSION="$(resolve_version database-url "${SECRET_VERSION_DATABASE_URL:-}")" || exit 1
USER_VERSION="$(resolve_version basic-auth-user "${SECRET_VERSION_BASIC_AUTH_USER:-}")" || exit 1
PASS_VERSION="$(resolve_version basic-auth-pass "${SECRET_VERSION_BASIC_AUTH_PASS:-}")" || exit 1
echo "database-url:${DB_VERSION} basic-auth-user:${USER_VERSION} basic-auth-pass:${PASS_VERSION}"

echo "== migrate =="
npm run build
NODE_ENV=production PORT=8080 \
  DATABASE_URL="${NEON_DATABASE_URL}" \
  BASIC_AUTH_USER="${STAGING_BASIC_AUTH_USER}" \
  BASIC_AUTH_PASSWORD="${STAGING_BASIC_AUTH_PASSWORD}" \
  LOG_LEVEL=info \
  npm run migrate

echo "== build & push =="
docker build -t "${IMAGE}:${SHA}" -t "${IMAGE}:latest" .
docker push "${IMAGE}:${SHA}"
docker push "${IMAGE}:latest"

echo "== deploy =="
gcloud run deploy "${GCP_RUN_SERVICE}" \
  --image "${IMAGE}:${SHA}" \
  --region "${GCP_REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --concurrency 80 \
  --timeout 60s \
  --set-env-vars "NODE_ENV=production,LOG_LEVEL=info,CORS_ALLOWED_ORIGINS=" \
  --set-secrets "DATABASE_URL=database-url:${DB_VERSION},BASIC_AUTH_USER=basic-auth-user:${USER_VERSION},BASIC_AUTH_PASSWORD=basic-auth-pass:${PASS_VERSION}"

echo "== verify =="
BASE_URL="$(gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" --format="value(status.url)")"
echo "服務網址：${BASE_URL}"
POLL_INTERVAL_SECONDS=10 POLL_TIMEOUT_SECONDS=300 BASE_URL="${BASE_URL}" npm run verify:health

# ---- T-0045 事故修法：驗證新 revision 是否真的接到 100% 流量 ----
# 事故根因：09-19 回滾演練以 `update-traffic --to-revisions <rev>=100` 把
# spec.traffic 從「一律跟隨最新 revision」改成「明確釘死在某個具名 revision」，
# 演練後未還原；之後每次 `gcloud run deploy` 都成功建立新 revision，但流量
# 從未切過去，而 verify 只打 service URL（同一網址），因此一直「全綠」。
# 主判準：直接讀 `status.traffic`，加總本次部署的 revision 拿到的百分比，
# 要求等於 100（`table[no-heading]` 格式帶方括號與引號無法解析，改用
# `csv[no-heading]`）。只看 latestReadyRevisionName 不夠：分流／canary
# 情境下它仍可能等於新 revision，但新 revision 只拿到部分流量，不檢查
# 百分比會漏判。`status.latestReadyRevisionName` 併作輔助佐證——已實測
# 它在 Cloud Run 目前實作中會跟隨接流量的 revision，但這是平台未文件化
# 行為，不是規格保證，故不單獨作為判準。
get_traffic_percent() {
  local revision="$1"
  gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" \
    --format="csv[no-heading](status.traffic.revisionName,status.traffic.percent)" \
    | awk -F, -v r="${revision}" '$1==r {s+=$2} END {print s+0}'
}

NEW_REVISION="$(gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" --format="value(status.latestCreatedRevisionName)")"
LATEST_READY="$(gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" --format="value(status.latestReadyRevisionName)")"
TRAFFIC_PCT="$(get_traffic_percent "${NEW_REVISION}")"
echo "新 revision：${NEW_REVISION}；取得流量：${TRAFFIC_PCT}%；latestReadyRevisionName：${LATEST_READY}（輔助佐證）"
if [ "${TRAFFIC_PCT}" != "100" ] || [ "${LATEST_READY}" != "${NEW_REVISION}" ]; then
  echo "新 revision（${NEW_REVISION}）未拿到 100% 流量（實際 ${TRAFFIC_PCT}%），目前流量分佈：" >&2
  gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" --format="csv[no-heading](status.traffic.revisionName,status.traffic.percent)" >&2
  echo "依 T-0045 事故修法自動執行 update-traffic --to-latest 並重新驗證"
  gcloud run services update-traffic "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" --to-latest
  BASE_URL="$(gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" --format="value(status.url)")"
  POLL_INTERVAL_SECONDS=10 POLL_TIMEOUT_SECONDS=300 BASE_URL="${BASE_URL}" npm run verify:health
  LATEST_READY="$(gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" --format="value(status.latestReadyRevisionName)")"
  TRAFFIC_PCT="$(get_traffic_percent "${NEW_REVISION}")"
  if [ "${TRAFFIC_PCT}" != "100" ] || [ "${LATEST_READY}" != "${NEW_REVISION}" ]; then
    echo "update-traffic --to-latest 後新 revision（${NEW_REVISION}）仍未拿到 100% 流量（實際 ${TRAFFIC_PCT}%），判定部署失敗，需人工介入（06 §5.1／§6.10）" >&2
    exit 1
  fi
  echo "update-traffic --to-latest 已生效，流量已在新 revision（${NEW_REVISION}，100%）"
else
  echo "流量已在新 revision（${NEW_REVISION}，100%），無需修正"
fi

CODE="$(curl -fsS -o /dev/null -w "%{http_code}" -u "${STAGING_BASIC_AUTH_USER}:${STAGING_BASIC_AUTH_PASSWORD}" "${BASE_URL}/api/v1/todos")"
echo "GET /api/v1/todos -> ${CODE}"
test "${CODE}" = "200"

echo "部署完成：${BASE_URL}（revision ${NEW_REVISION}，流量 $(get_traffic_percent "${NEW_REVISION}")%）"
echo "首次部署後請回填 STAGING_BASE_URL（GitHub variable）、06 §1、04_API規格.yaml servers。"
