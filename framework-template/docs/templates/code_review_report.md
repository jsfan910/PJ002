# Code Review 報告：T-0000 {標題}

<!-- 檔名：docs/reports/yyyymmdd-HHmm-CR-T0000.md -->
<!-- 通過門檻：阻擋級 = 0。建議級由 dev-tl 決定是否本輪修。 -->

- 審查者：qa-cr（round {n}）
- 審查範圍：分支 task/T-0000-{slug}，commit {sha}
- 對照文件：docs/specs/03_系統設計書_SD.md#…、docs/specs/04_API規格.yaml#…
- 結論：**通過 / 退回**（阻擋級 {n} 項、建議級 {m} 項）

## 發現

| # | 嚴重度 | 檔案:行號 | 說明 | 修正建議 |
|---|---|---|---|---|
| 1 | 阻擋 | src/x.py:42 | | |
| 2 | 建議 | | | |

嚴重度定義：
- **阻擋**：正確性錯誤、安全漏洞、違反設計書／API 規格、資料遺失風險、缺少必要測試。
- **建議**：可維護性、命名、重複、效能非關鍵路徑。

## 檢查清單

- [ ] 符合 API 規格（路徑、方法、狀態碼、schema）
- [ ] 符合資料庫設計（欄位、約束、索引）
- [ ] 錯誤處理與輸入驗證
- [ ] 安全（注入、認證授權、敏感資料不落日誌）
- [ ] 單元測試存在且有意義（非只測 happy path）
- [ ] 無硬編碼密鑰／環境值
- [ ] 遵守 ADR

## 憑證掃描已知例外（命中後逐筆判讀，不在此清單者一律視為真命中）

1. `ci.yml` service container 的 CI 佔位值（`ci`／`ci`）。
2. GitHub Actions `permissions: id-token: write`。
3. `gcloud run deploy --set-secrets "ENV=secret-name:version"` 的參照語法。
4. `.env.example` 與測試檔的本機佔位值（Leader 裁決 D-01；值必須是明顯佔位如 `dev`、`localhost`）。
