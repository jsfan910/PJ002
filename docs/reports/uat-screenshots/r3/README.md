# R3 UAT 截圖說明

## 前端連接錯誤頁面

**日期**：2026-09-19 16:45:00+08:00  
**環境**：staging https://todo-app-dpevsdhdva-de.a.run.app  
**狀態**：前端無法連接到 API（BLOCKED）

### 頁面內容

```
【頁面標題】待辦事項

【新增表單】
- 輸入框：「輸入待辦事項標題」
- 按鈕：「新增」（藍色）

【篩選按鈕】
- 「全部」（藍色，激活狀態）
- 「未完成」
- 「已完成」

【錯誤訊息區域】（紅色背景）
無法連線到伺服器，請檢查網路連線後重試。
- 「繼續重試」連結
- 「重試」按鈕

【清單區域】
目前沒有任何待辦事項，新增一筆開始吧。
```

### 錯誤原因

前端瀏覽器 JavaScript 應用嘗試連接到 `/api/v1/todos` API 端點失敗。根本原因為：

**瀏覽器安全政策限制**：
- 頁面從帶認證信息的 URL 載入（`https://<username>:<password>@...`）
- Chromium 安全模型禁止此上下文中的 JavaScript 發送包含認證信息的請求
- 前端應用未配置替代認證方案（如 Authorization 標頭或 session cookie）

### 驗證

✓ Staging 環境本身正常：
- `/health` 無認證返回 200 OK
- `/api/v1/todos` 通過 curl -u 返回 200 OK

✗ 前端瀏覽器無法進行 fetch 請求：
- 錯誤：`Request cannot be constructed from a URL that includes credentials`

### 下一步

1. 前端開發者修正認證方案（見報告建議）
2. 重新執行 r4 UAT 驗證修正
3. 或使用臨時方案（curl 腳本驗證 API）

---

**報告**：`docs/reports/20260919-1641-UAT-E001-r3.md`
