# {專案名稱}

<!-- DoD：新 session 依本文件可在 15 分鐘內把專案跑起來（qa-at 實測驗證並在交接檔記錄實際耗時）。 -->

## 一句話

（這個系統做什麼）

## 快速開始

```bash
# 1. 安裝
# 2. 設定環境變數（複製 .env.example → .env）
# 3. 啟動
# 4. 驗證：curl http://localhost:8000/health
```

## 常用指令

| 目的 | 指令 |
|---|---|
| 單元測試 | |
| Lint | |
| 整合測試 | |
| 本機啟動 | |

## 指令在哪裡執行

<!-- 骨架：凡是本文件出現雲端 CLI 或 secret 相關指令，都必須先回答「在哪裡打」，
     否則使用者會在錯的殼層執行而卡住（框架首輪試跑實際發生的五個陷阱如下）。 -->

| 指令種類 | 可執行環境 | 注意 |
|---|---|---|
| 雲端 CLI（建專案、設權限、建 secret） | ① 雲端供應商的網頁 Shell（免安裝，推薦）② 本機 SDK | 兩者指令內容相同 |
| 專案指令（build / test / lint / 啟動） | 本機 Git Bash 或 PowerShell | 跨 shell 的 npm script 為標準 |

### Windows 陷阱（逐項寫明，不要只寫「請自行調整」）

- **執行檔名**：本機 SDK 的 CLI 若本體是 shell script，`cmd.exe` 與 PowerShell 下必須加 `.cmd` 後綴（Git Bash 不用）。保守起見一律加。
- **佔位符**：文件中的 `<PROJECT_ID>`、`<owner>/<repo>` 等**必須連角括號一起替換**。未替換時多數指令不會報錯，而是把字面字串當成值寫進設定，之後才以難懂的訊息失敗。
- **引號**：`cmd.exe` 的 `echo` 不處理單引號（會原樣印出）；內含 JSON 時改用兩個雙引號跳脫。
- **process substitution**：`<(echo ...)` 在 PowerShell／`cmd.exe` 不存在，一律改成「先寫暫存檔、再用 `--xxx-file=` 引用、最後刪檔」。
- **寫入 secret 值**：PowerShell 的 `Set-Content`／`>` 會在檔尾多加換行，混入 secret 會造成難查的驗證失敗。改用 `[System.IO.File]::WriteAllText(...)` 寫檔後再上傳。
- **量測 secret 位元組數**：**先落地成檔案再量檔案大小**，不要對管線輸出量測（跨殼層的換行轉換會讓結果兩個方向都可能出錯，造成假警報或漏判）。
- **讀 `.env` 之類的 UTF-8 無 BOM 檔**：PowerShell 5.1 的 `Get-Content` 可能誤判編碼併行，改用 `[System.IO.File]::ReadAllLines()`。

```bash
# 兩種 shell 各給一段可逐字照抄的範例，不可只給其中一種
```

## 目錄結構

（對應 SD 第 8 章）

## 文件地圖

- 規格：`docs/specs/`
- 任務：`tasks/`
- 部署：`docs/specs/06_部署架構與CICD.md`
