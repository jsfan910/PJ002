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
# **T-0044 新增的編碼注意事項**：既有告警政策（下方 ALERT_POLICY_ID）的
# `documentation.content` **實際內容是中文**，GCP 端儲存為正確 UTF-8（已用
# `creationRecord.mutateTime` 與 `mutationRecord.mutateTime` 相同這件事確認
# 建立後從未被更新過）。本機 Windows 版 gcloud 在**讀回**（`describe`／印出）
# 時，若未設定 UTF-8 環境變數，會把中文字元顯示成字面 `?`（位元組 `0x3f`，
# 這是本機讀出路徑的有損轉碼，不是雲端資料損壞，不要據此重建或刪除政策）。
# **解法：呼叫 `describe` 前加 `PYTHONUTF8=1 PYTHONIOENCODING=utf-8`**（下方
# `describe-alert-policy` 分支已內建這兩個變數）。
# 若之後要**新建**其他政策，建議 `--policy-from-file` 的 JSON 內容改用英文／
# ASCII，可完全迴避此讀回陷阱；但這只是「日後新建」的建議，**不代表既有這個
# 政策的內容是英文**——上面已說明它是中文且雲端資料正確。
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
    echo "[警告] 告警政策已建立過（$ALERT_POLICY_NAME，displayName todo-app uptime check failure，"
    echo "documentation.content 現況為中文、GCP 端 UTF-8 正確，見本檔開頭「編碼注意事項」）。"
    echo "重複執行會建立第二個政策。如確定要建立新的一份，需先安裝 alpha 元件（非互動模式"
    echo "需先設 CLOUDSDK_PYTHON，見下方指令），再以 --policy-from-file 指向一份政策 JSON。"
    echo "（建議：新建時內容改用英文／ASCII 可迴避讀回陷阱，但這只是日後新建的建議，"
    echo "不代表上面這個既有政策是英文的）。範例："
    echo
    cat <<'EOF'
# 一次性：非互動模式安裝 alpha 元件
CLOUDSDK_PYTHON=$("$GCLOUD" components copy-bundled-python 2>&1 | tail -1)
CLOUDSDK_PYTHON="$CLOUDSDK_PYTHON" "$GCLOUD" components install alpha --quiet

# 建立政策（policy.json 內容範例見 06 §6.1.1；建議新建時用英文/ASCII 迴避讀回陷阱，
# 並在建立後以 PYTHONUTF8=1 PYTHONIOENCODING=utf-8 重新 describe 確認內容正確）
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
