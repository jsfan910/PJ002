#!/usr/bin/env bash
# scripts/deploy-staging.sh（T-0018，OPS-03）
#
# .github/workflows/deploy-staging.yml 的本機等效（Git Bash 可執行）。
# 供使用者在取得 GCP 專案與 gcloud 登入後，於本機手動重現一次部署
# （NFR-008「未參與者 15 分鐘內...可重現一次 staging 部署」）。
# 階段順序與 workflow 完全一致：auth 前置 → migrate → build & push → deploy → verify。
#
# 前置需求（使用者自行完成，agent 不索取、不代填）：
#   - 已執行 `gcloud auth login` 或已有 Application Default Credentials
#   - 已 export 下列環境變數（值不寫入本檔、不進版控）：
#       GCP_PROJECT_ID GCP_REGION GCP_AR_REPOSITORY GCP_RUN_SERVICE
#       NEON_DATABASE_URL STAGING_BASIC_AUTH_USER STAGING_BASIC_AUTH_PASSWORD
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

echo "== auth =="
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

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
  --set-secrets "DATABASE_URL=database-url:latest,BASIC_AUTH_USER=basic-auth-user:latest,BASIC_AUTH_PASSWORD=basic-auth-pass:latest"

echo "== verify =="
BASE_URL="$(gcloud run services describe "${GCP_RUN_SERVICE}" --region "${GCP_REGION}" --format="value(status.url)")"
echo "服務網址：${BASE_URL}"
POLL_INTERVAL_SECONDS=10 POLL_TIMEOUT_SECONDS=300 BASE_URL="${BASE_URL}" npm run verify:health
CODE="$(curl -fsS -o /dev/null -w "%{http_code}" -u "${STAGING_BASIC_AUTH_USER}:${STAGING_BASIC_AUTH_PASSWORD}" "${BASE_URL}/api/v1/todos")"
echo "GET /api/v1/todos -> ${CODE}"
test "${CODE}" = "200"

echo "部署完成：${BASE_URL}"
echo "首次部署後請回填 STAGING_BASE_URL（GitHub variable）、06 §1、04_API規格.yaml servers。"
