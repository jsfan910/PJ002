#!/usr/bin/env bash
# infra/uptime-check.sh（T-0031，NFR-003 主要採樣來源：Cloud Monitoring uptime check）
#
# 背景：GitHub Actions monitor-health.yml 的 schedule 觸發長時間（>2 小時）
# 零次自動執行（診斷見 docs/reports/*-監測補強-E001.md、06 §6.8）。Leader 裁決
# （tasks/E-001-todo-app.md 2026-09-19T17:47:01+08:00 裁決 B）：新增本 uptime
# check 作為 NFR-003 主要資料來源，GitHub cron 降為備援。
#
# 本檔可重跑：create 為一次性（重跑會建立第二個同名 check，故預設只示範一次
# 建立指令並註記已建立的 check id）；describe/list 為判讀與稽核用，可隨時重跑。
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
# 用法：
#   bash infra/uptime-check.sh create    # 一次性建立（已執行過，見下方紀錄，勿重複執行）
#   bash infra/uptime-check.sh list      # 列出目前所有 uptime check
#   bash infra/uptime-check.sh describe  # 顯示本 check 的完整設定

set -euo pipefail

GCLOUD="C:/Users/excal/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"

GCP_PROJECT_ID="pj002-509106"
STAGING_HOST="todo-app-dpevsdhdva-de.a.run.app"
DISPLAY_NAME="todo-app-health"

# 已建立的 check（本卡實跑紀錄，見 B 段與報告）：
#   name: projects/pj002-509106/uptimeCheckConfigs/todo-app-health-aMAlP5dfKv0
#   建立時間：2026-09-19T09:55:07Z（UTC） = 2026-09-19T17:55:07+08:00
CHECK_ID="todo-app-health-aMAlP5dfKv0"

cmd="${1:-describe}"

case "$cmd" in
  create)
    echo "[警告] 本 check 已建立過（$CHECK_ID）。重複執行會建立第二個同名 check。"
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
  *)
    echo "用法：bash infra/uptime-check.sh {create|list|describe}" >&2
    exit 1
    ;;
esac
