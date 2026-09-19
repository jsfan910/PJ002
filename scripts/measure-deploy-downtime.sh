#!/usr/bin/env bash
# scripts/measure-deploy-downtime.sh（T-0031，TC-080／TC-090 直接量測）
#
# 每 1 秒 curl STAGING_BASE_URL/health（不帶憑證，符合 06 §3.3「監測不帶憑證」
# 的原則），記錄時間戳與 HTTP 狀態碼，持續到指定秒數，寫入 CSV；結束後計算
# 最長連續失敗秒數（NFR-003 後半／TC-090 門檻 < 60 秒）。
#
# 用法：
#   bash scripts/measure-deploy-downtime.sh [持續秒數，預設 300] [輸出檔，預設 deploy-downtime.csv]
#
# 建議用法：在觸發一次新部署（例如 dev-tl 合併本卡並 push main，或
# `gcloud run services update --update-env-vars` 加一個無害變數）之前幾秒
# 啟動本腳本，持續到 verify 階段完成後再多跑 1 分鐘，確保涵蓋整段切流量過程。

set -uo pipefail

DURATION="${1:-300}"
OUT="${2:-deploy-downtime.csv}"
STAGING_BASE_URL="${STAGING_BASE_URL:-https://todo-app-dpevsdhdva-de.a.run.app}"

echo "timestamp_utc,http_code,time_total_seconds" > "${OUT}"

START_EPOCH=$(date +%s)
END_EPOCH=$((START_EPOCH + DURATION))

echo "開始量測：${STAGING_BASE_URL}/health，持續 ${DURATION} 秒，輸出 ${OUT}"

while [ "$(date +%s)" -lt "${END_EPOCH}" ]; do
  TS="$(date -u "+%Y-%m-%dT%H:%M:%S.%3NZ" 2>/dev/null || date -u "+%Y-%m-%dT%H:%M:%SZ")"
  OUTPUT="$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" --max-time 5 "${STAGING_BASE_URL}/health" 2>/dev/null || echo "000 0")"
  CODE="$(echo "${OUTPUT}" | awk '{print $1}')"
  TIME_TOTAL="$(echo "${OUTPUT}" | awk '{print $2}')"
  echo "${TS},${CODE},${TIME_TOTAL}" >> "${OUT}"
  sleep 1
done

echo "量測結束。計算最長連續失敗秒數（非 200 視為失敗，取樣間隔近似 1 秒）："

awk -F, 'NR>1 {
  if ($2 != "200") {
    if (fail_start == "") { fail_start = $1; fail_count = 0 }
    fail_count++
    if (fail_count > max_fail) { max_fail = fail_count; max_fail_start = fail_start; max_fail_end = $1 }
  } else {
    fail_start = ""
    fail_count = 0
  }
}
END {
  if (max_fail == "") { max_fail = 0 }
  printf "最長連續失敗次數（約秒數，取樣間隔 ~1s）：%d\n", max_fail
  if (max_fail > 0) {
    printf "失敗區間：%s ~ %s\n", max_fail_start, max_fail_end
  } else {
    print "全程無非 200 回應。"
  }
}' "${OUT}"
