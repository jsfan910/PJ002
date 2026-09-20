---
id: T-0042
title: unit 層 TC-ID 標註、Release Notes v0.1.0（P0）定版、CHANGELOG 收斂
epic: E-001
team: dev
role: dev-tl
model: opus
phase: dev
status: done
round: 1
depends_on: [T-0038, T-0043]   # T-0039 程式已合併 main（3345022），僅部署綠燈待使用者 IAM，Leader 2026-09-20 19:39 裁決以合併為準；T-0041 因環境限制 blocked（Leader 2026-09-20 19:07 裁決解除依賴）；Firefox 結果以「已知限制」寫入 Release Notes
inputs:
  - docs/reports/20260920-1806-測試總結-E001-r3.md#4（R-6：unit 層 11 條 TC 無法逐條追溯）與 #1（退出準則最終數字）
  - docs/reports/20260920-1822-Gate2-E001-r2.md（有條件通過與使用者三項裁決）
  - docs/specs/20_測試案例.md（TC-001～003、012、019、020、030、038、039、048、059 的內容）
  - tests/unit/**（現行 5 個測試檔）
  - docs/specs/14_ReleaseNotes.md、docs/templates/dev_14_ReleaseNotes.md、CHANGELOG.md
  - docs/specs/24_缺陷清單.md（開放缺陷 D-014、D-017 現況）
  - T-0038、T-0039、T-0041 的交接檔 B 段
outputs:
  - tests/unit/**（只加測試名稱或註解中的 TC-ID，不改斷言）
  - docs/specs/14_ReleaseNotes.md
  - CHANGELOG.md
acceptance:
  - 11 條 unit 層 TC-ID 各自在 tests/unit 至少出現一次（`grep -c` 逐條貼出）；`npm run test:unit` 全綠且案例數不減少
  - Release Notes v0.1.0（P0）：功能清單對應 US-001～US-010、staging 網址（不含憑證）、Gate 2 判定「有條件通過（2026-09-20，使用者裁決）」與條件、已知限制（開放 S3：D-014、D-017 現況；NFR-004 依 T-0041 結果；NFR-007 前端子項僅本機）、回滾方式指引（指向 06 §5）
  - CHANGELOG 含 T-0038／T-0039 合併條目與 v0.1.0 版本標記；日期為實查系統時間
  - main 上建 annotated tag `v0.1.0`（只建不刪；推送 tag 與否於交接檔註明並留 Leader 決定）
  - 不動 outputs 以外的檔案
reviewer: leader
branch: task/T-0042-tcid-release-notes
created: 2026-09-20T18:35:00+08:00
updated: 2026-09-20T19:57:11+08:00
blocked_reason: null
---

## 目標

Gate 2 有條件通過後的定版：讓 unit 層 P0 案例可逐條追溯（關閉 R-6），並以 Release Notes v0.1.0 記錄 P0 交付範圍、判定與已知限制，作為 P1 起點。

## 背景與限制

- 上游：Leader 2026-09-19T14:06:43 裁決 C（unit TC-ID 補標列 P1）；使用者 2026-09-20 Gate 2 r2 裁決① A、③ A。
- 下游：P1（US-011～013）開卡以 v0.1.0 為基線。
- 必須遵守：CLAUDE.md 協作協定與工作鐵則；角色檔 `.claude/agents/dev-tl.md`；**在 git worktree `<根目錄>-wt/T-0042` 內作業**，合併回 main 由 dev-tl 自己在根目錄執行。
- 依賴三卡都 done 後才啟動，以便 CHANGELOG 與已知限制反映最終狀態。

## 驗收方式

Leader：

```bash
for tc in TC-001 TC-002 TC-003 TC-012 TC-019 TC-020 TC-030 TC-038 TC-039 TC-048 TC-059; do printf "%s " "$tc"; grep -rc "$tc" tests/unit | awk -F: "{s+=\$2} END {print s}"; done
npm run test:unit
git tag -l "v0.1.0" -n1
sed -n 1,40p docs/specs/14_ReleaseNotes.md
```

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | leader | done | 根目錄實跑：11 條 TC-ID 全命中、unit 78/78、lint 0、tag v0.1.0 指向 ddc66bb、Release Notes released、CHANGELOG 0.1.0。裁決：推送 main 與 tag；R-6 以「可逐條追溯」為關閉標準，補測與否交 qa-lead。 | worklog/handoff/20260920-1957-T0042-r1-leader.md |
