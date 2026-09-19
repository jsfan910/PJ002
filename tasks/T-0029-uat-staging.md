---
id: T-0029
title: UAT r3：於 staging 逐 P0 使用者故事操作
epic: E-001
team: qa
role: qa-uat
model: sonnet
status: done
round: 2
depends_on: [T-0027]
inputs:
  - docs/reports/20260919-1301-UAT-E001-r2.md（本機基準與操作方式）
  - docs/specs/01_需求規格書_SRS.md（US-001～US-010）
  - docs/specs/20_測試案例.md（層級 uat）
  - docs/templates/qa_23_UAT報告.md
outputs:
  - docs/reports/yyyymmdd-HHmm-UAT-E001-r3.md
  - docs/reports/uat-screenshots/r3/
acceptance:
  - 在 staging（https://todo-app-dpevsdhdva-de.a.run.app）逐 US-001～US-010 操作，每步「做了什麼 → 看到什麼」；操作方式沿用 r2（先以帶帳密網址載入建立認證快取，再以裸網址操作）
  - US-010（staging 部署）以實際網址驗證：/health 200、未帶憑證 401、帶憑證可用
  - 冷啟動體驗記錄：閒置 15 分鐘後首次載入耗時（供 NFR-001 離群值參考）
  - 報告不含憑證
reviewer: qa-lead
branch: null
created: 2026-09-19T16:31:34+08:00
updated: 2026-09-19T17:38:24+08:00
blocked_reason: null
---

## 目標

以終端使用者視角在真實 staging 確認 P0 十則可用。

## 背景與限制

- Basic Auth 帳密由使用者提供，Leader 派工時以環境變數轉交；報告與交接檔不得出現。
- 必須遵守：CLAUDE.md「協作協定」、角色檔 .claude/agents/qa-uat.md 的通用協定。

## 驗收方式

qa-lead：抽查 2 個 US 的操作紀錄可重現；核對 P0 十則皆有結果。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | leader | rework→r2 | r1 報 8/10 阻擋「前端連不上 API」；Leader 以瀏覽器實測 staging 頁面載入且 GET /api/v1/todos 200，判為工具操作問題；r2 模型升 sonnet | worklog/handoff/20260919-工作交接.md |
| r2 | qa-lead | **done** | 報告 `docs/reports/20260919-1656-UAT-E001-r4.md`，P0 十則於真實 staging 10／10。**抽查 US-010**（可在無憑證下完整複驗）：qa-lead 於 2026-09-19T17:32 對 staging 實跑 `GET /health` → **200**、`GET /` → **401**、`GET /api/v1/todos` → **401**，**與報告逐字相符**；HTTPS／導向另以 `curl -sSI http://.../health` → `302 Found` ＋ `location: https://.../health` 佐證（TC-079，Leader 已裁決 302 等效）。**抽查 US-006／US-001 的操作紀錄**（需憑證的 UI 步驟無法直接重放，改以「報告引述的畫面文字必須在出貨前端原始碼中逐字存在」交叉驗證）：「此篩選下沒有待辦事項。」＝`public/assets/todo-view.js:222`、「目前沒有任何待辦事項，新增一筆開始吧。」＝`:220`、「找不到這筆待辦，可能已被刪除。」＝`public/assets/todo-store.js:82`、「標題不可為空白」＝`:40`、`window.confirm("確定要刪除「${todo.title}」嗎？此操作無法復原。")`＝`todo-view.js:144`、「載入中…」＝`public/index.html:76`，**六條全部逐字命中**；`maxlength=200` 同時見於 `public/index.html:34` 與 `todo-view.js:165`，佐證 AC-001-3 的「第 201 字元打不進去」敘述。**冷啟動**：報告誠實記為「未量測（真冷啟動）」，本卡認可此揭露並列為殘留風險 R-5。**環境現象**（staging 資料被平行 agent 快速刪除）已編為 **OBS-7**（觀察，非缺陷）。**本卡限制**：未取得 staging 憑證，需認證的 UI 步驟係採信本報告紀錄，未親自重放（已於測試總結 r2 §3、§7.8 誠實揭露）。**另更正卡面**：frontmatter 殘留 r1 的 `blocked_reason` 多行文字導致 YAML 結構損壞（`blocked_reason: null` 後接縮排文字），該結論已被 Leader 證偽，本卡於審核時移除該段並補 `status: done`。 | worklog/handoff/20260919-1731-T0030-r1-qa-lead.md |
