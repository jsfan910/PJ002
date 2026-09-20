#!/usr/bin/env bash
# infra/uptime-check.sh（T-0031 主 check；T-0044 新增 backup check ＋ 告警政策）
#
# 背景：GitHub Actions monitor-health.yml 的 schedule 觸發長時間（>2 小時）
# 零次自動執行（診斷見 docs/reports/*-監測補強-E001.md、06 §6.8）。Leader 裁決
# （tasks/E-001-todo-app.md 2026-09-19T17:47:01+08:00 裁決 B）：新增本 uptime
# check 作為 NFR-003 主要資料來源，GitHub cron 降為保溫用（T-0040）。
#
# T-0044：Leader 2026-09-20T19:37:36+08:00 裁決 06 §6.1.1 備援缺口採「選項 A」
# ——新增第二個 uptime check 作為真備援，並加告警政策（不綁通知管道，email 由
# 使用者自行建立與綁定）。
#
# 本檔可重跑：create／create-backup／create-alert-policy 皆為一次性（重跑會
# 建立第二份同名資源，故預設只示範指令並註記已建立的實際 id，不自動重跑）；
# list／describe／list-alert-policies／describe-alert-policy 為判讀與稽核用，
# 可隨時重跑。
#
# gcloud 路徑（本機）：
#   Windows: "C:/Users/excal/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
#
# **Git Bash 注意事項（本卡踩到的坑）**：Git Bash（MSYS2）預設會把以 `/` 開頭的
# 參數（例如 `--path=/health`）自動轉換成 Windows 路徑（例如
# `C:\Users\...\health`），導致 gcloud.cmd 收到一串帶空白的錯誤路徑而整個
# 指令解析失敗（錯誤訊息會顯示成一段看似無關的 Windows 路徑）。
# **解法：在呼叫 gcloud 前加 `MSYS_NO_PATHCONV=1`**（僅影響本次呼叫，不改全域環境）。
# PowerShell 沒有這個問題，不需要這個變數。
#
# **T-0044 新增的編碼注意事項**：`--policy-from-file` 的 JSON 若含中文（例如
# documentation.content），本機 Windows 版 gcloud 在未設定 UTF-8 環境變數時，
# 讀檔與印出結果都可能把中文字元換成字面 `?`（非終端機顯示問題，是實際輸出
# 內容被有損轉碼）。**解法：呼叫前加 `PYTHONUTF8=1 PYTHONIOENCODING=utf-8`**。
# 本檔的告警政策 JSON 一律只用英文／ASCII，避免此問題（見下方 alert policy
# JSON 內嵌內容）；若之後要改中文說明，記得連同這兩個環境變數一起設定，並用
# `describe` 重新讀回確認位元組正確（不要只看終端機顯示）。
#
# 用法：
#   bash infra/uptime-check.sh create               # 主 check 一次性建立（已執行過，勿重複執行）
#   bash infra/uptime-check.sh list                  # 列出目前所有 uptime check
#   bash infra/uptime-check.sh describe               # 顯示主 check 的完整設定
#   bash infra/uptime-check.sh create-backup          # backup check 一次性建立（已執行過，勿重複執行）
#   bash infra/uptime-check.sh describe-backup        # 顯示 backup check 的完整設定
#   bash infra/uptime-check.sh create-alert-policy    # 告警政策一次性建立（已執行過，勿重複執行）
#   bash infra/uptime-check.sh list-alert-policies    # 列出目前所有告警政策
#   bash infra/uptime-check.sh describe-alert-policy  # 顯示本告警政策的完整設定

set -euo pipefail

GCLOUD="C:/Users/excal/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"

GCP_PROJECT_ID="pj002-509106"
STAGING_HOST="todo-app-dpevsdhdva-de.a.run.app"
DISPLAY_NAME="todo-app-health"

# 已建立的主 check（T-0031 實跑紀錄，見 06 §6.8.2）：
#   name: projects/pj002-509106/uptimeCheckConfigs/todo-app-health-aMAlP5dfKv0
#   建立時間：2026-09-19T09:55:07Z（UTC） = 2026-09-19T17:55:07+08:00
CHECK_ID="todo-app-health-aMAlP5dfKv0"

# 已建立的 backup check（T-0044 實跑紀錄，見 06 §6.1.1）：
#   name: projects/pj002-509106/uptimeCheckConfigs/todo-app-health-backup-yvjsI-2xna0
#   建立時間：2026-09-20T12:19:xxZ（UTC，見 06 §6.1.1 實查輸出）
#   地區組合與主 check 不同：asia-pacific／south-america／usa-virginia
#   （主 check 為 asia-pacific／usa-oregon／usa-iowa／europe）
BACKUP_DISPLAY_NAME="todo-app-health-backup"
BACKUP_CHECK_ID="todo-app-health-backup-yvjsI-2xna0"

# 已建立的告警政策（T-0044 實跑紀錄，見 06 §6.1.1／§6.3）：
#   name: projects/pj002-509106/alertPolicies/8479925612924794663
#   條件：兩個 check 各一條 conditionThreshold（OR 合併），10 分鐘對齊窗內
#   任一 check 的任一檢查地區出現失敗取樣（REDUCE_COUNT_FALSE > 0）即觸發。
#   未綁定任何通知管道（email 由使用者自行建立並綁定，見 README）。
ALERT_POLICY_ID="8479925612924794663"
ALERT_POLICY_NAME="projects/pj002-509106/alertPolicies/${ALERT_POLICY_ID}"

cmd="${1:-describe}"

case "$cmd" in
  create)
    echo "[警告] 主 check 已建立過（$CHECK_ID）。重複執行會建立第二個同名 check。"
    echo "如確定要建立新的一組，請直接執行下列指令（可改 DISPLAY_NAME 以免混淆）："
    echo
    cat <<'EOF'
MSYS_NO_PATHCONV=1 "$GCLOUD" monitoring uptime create "todo-app-health" \
  --resource-type=uptime-url \
  --resource-labels=host=todo-app-dpevsdhdva-de.a.run.app,project_id=pj002-509106 \
  --protocol=https \
  --port=443 \
  --path=/health \
  --period=5 \
  --timeout=10 \
  --regions=asia-pacific,usa-oregon,usa-iowa,europe \
  --status-codes=200 \
  --format=json
EOF
    ;;
  list)
    "$GCLOUD" monitoring uptime list-configs --format="table(name,displayName,period,timeout,selectedRegions.list())"
    ;;
  describe)
    "$GCLOUD" monitoring uptime describe "${CHECK_ID}" --format=json
    ;;
  create-backup)
    echo "[警告] backup check 已建立過（$BACKUP_CHECK_ID）。重複執行會建立第二個同名 check。"
    echo "如確定要建立新的一組，請直接執行下列指令："
    echo
    cat <<'EOF'
MSYS_NO_PATHCONV=1 "$GCLOUD" monitoring uptime create "todo-app-health-backup" \
  --resource-type=uptime-url \
  --resource-labels=host=todo-app-dpevsdhdva-de.a.run.app,project_id=pj002-509106 \
  --protocol=https \
  --port=443 \
  --path=/health \
  --period=5 \
  --timeout=10 \
  --regions=asia-pacific,south-america,usa-virginia \
  --status-codes=200 \
  --format=json
EOF
    ;;
  describe-backup)
    "$GCLOUD" monitoring uptime describe "${BACKUP_CHECK_ID}" --format=json
    ;;
  create-alert-policy)
    echo "[警告] 告警政策已建立過（$ALERT_POLICY_NAME）。重複執行會建立第二個政策。"
    echo "如確定要建立新的一份，需先安裝 alpha 元件（非互動模式需先設 CLOUDSDK_PYTHON，"
    echo "見下方指令），再以 --policy-from-file 指向一份政策 JSON（內容只用英文／ASCII，"
    echo "理由見本檔開頭「編碼注意事項」）。範例："
    echo
    cat <<'EOF'
# 一次性：非互動模式安裝 alpha 元件
CLOUDSDK_PYTHON=$("$GCLOUD" components copy-bundled-python 2>&1 | tail -1)
CLOUDSDK_PYTHON="$CLOUDSDK_PYTHON" "$GCLOUD" components install alpha --quiet

# 建立政策（policy.json 內容範例見 06 §6.1.1；務必只用英文/ASCII，
# 並在建立後以 PYTHONUTF8=1 PYTHONIOENCODING=utf-8 重新 describe 確認）
"$GCLOUD" alpha monitoring policies create --policy-from-file=policy.json --format=json
EOF
    ;;
  list-alert-policies)
    "$GCLOUD" alpha monitoring policies list --format="table(name,displayName,enabled)"
    ;;
  describe-alert-policy)
    PYTHONUTF8=1 PYTHONIOENCODING=utf-8 "$GCLOUD" alpha monitoring policies describe "${ALERT_POLICY_NAME}" --format=json
    ;;
  *)
    echo "用法：bash infra/uptime-check.sh {create|list|describe|create-backup|describe-backup|create-alert-policy|list-alert-policies|describe-alert-policy}" >&2
    exit 1
    ;;
esac
