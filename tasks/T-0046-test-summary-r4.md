---
id: T-0046
title: 測試總結 r4：關閉 D-017、立 D-018（pipeline 驗證失效）、TC-090 重測結果、退出準則與追溯更新
epic: E-001
team: qa
role: qa-lead
model: opus
phase: qa-staging
status: done
round: 1
depends_on: [T-0045]
inputs:
  - docs/reports/20260920-1806-測試總結-E001-r3.md（r3 全表；本輪沿用其結構）
  - docs/reports/20260920-1822-Gate2-E001-r2.md（使用者裁決 ① A ② B ③ A）
  - docs/reports/20260920-2132-D017-staging重跑-使用者實測.md（TC-067／TC-009 × 4 project × 5 輪 40／40，revision 00019-k5q）
  - docs/reports/20260920-2042-流量釘死事故-E001.md 與 docs/specs/06_部署架構與CICD.md#6.10（事故時間軸、影響範圍、給 qa-lead 的重驗清單、真實部署重測 run 35513187463：226／226 樣本 0 秒）
  - docs/reports/20260920-1901-AT-E001-r4-firefox.md（TC-091 仍 4／6，環境限制）
  - tasks/E-001-todo-app.md（2026-09-20 各段裁決：TC-080 追認、R-6 以可逐條追溯關閉、備援採 A）
  - worklog/handoff/20260920-1940-T0042-r1-dev-tl.md（unit TC-ID 標註對應表，R-6 認定用）
  - docs/specs/24_缺陷清單.md、docs/specs/traceability.md、docs/specs/07_測試計畫.md#4、#5（嚴重度定義）
outputs:
  - docs/reports/20260920-2145-測試總結-E001-r4.md
  - docs/specs/24_缺陷清單.md（D-017 closed；新增 D-018 pipeline 驗證失效；摘要表更新）
  - docs/specs/traceability.md（僅主表「狀態」欄：US-001／US-008 的 TC-009／TC-067；US-010 的 TC-090 重測引用）
acceptance:
  - D-017 依關閉條件（staging 重跑 TC-067／TC-009 ≥ 5 次連續全過）判 closed，證據引用使用者實測紀錄與 revision 00019-k5q；qa-lead 須自行以不帶憑證的方式至少確認 staging 現行 revision 與 /health（貼輸出），不採信轉述以外的任何未驗事實
  - 新增 D-018：deploy-staging 的 verify 只打 service URL、未驗新 revision 接到流量，使 09-19 演練後 15 個 revision 未上線而每次 run 全綠；嚴重度依 07 §5 判定並寫明理由（建議 S2：驗證失效、非資料損毀）；狀態 closed（T-0045 已修：主判準讀 status.traffic =100，真實 run 35513187463 驗證），根因與修法引用 06 §6.10
  - 退出準則 12 項逐格更新：第 1 項重算（TC-009／TC-067 由部分通過轉通過、TC-080 依使用者裁決②追認為通過；預期 104／105，缺口僅 TC-091 Firefox 工具限制）；第 12 項改引 T-0045 真實部署重測（226／226、0 秒），並註明 T-0031 的「revision 00008 切換」量測因流量未切而無效、AT r3 的 TC-090 量測存疑；第 6 項註明 24 小時採樣期間服務的是 00003-lt2（P0 程式），結論不變；其餘項標「沿用 r3」
  - §1.2 列 r3 → r4 逐項變化；§4 殘留風險：R-2（TC-080 直接比對）維持列 P1 staging 輪、R-6 依 Leader 裁決以「可逐條追溯」關閉並註明 6 條部分覆蓋、新增事故相關風險（歷史 staging 結論的適用範圍）
  - 建議明確（可發布／有條件可發布／不可發布）＋給 Leader 的裁決事項（五段式）；其中須含「Release Notes v0.1.0 需附註更正 staging 現況」的建議
  - traceability 主表 TC-009／TC-067 狀態改通過（引用證據路徑），TC-090 引用重測；孤兒檢查六項重跑仍「無」
reviewer: leader
branch: null
created: 2026-09-20T21:33:00+08:00
updated: 2026-09-20T21:55:00+08:00
blocked_reason: null
---

## 目標

把今天 Gate 2 後的所有變化收斂成一份可簽核的數字：D-017 關閉、pipeline 事故立案並關閉、TC-090 以有效量測取代無效量測、退出準則第 1 項與第 12 項更新，供 Leader 決定是否出 Gate 2 報告 r3 附錄與開 P1。

## 背景與限制

- 上游：T-0038／T-0043（D-017 修正與 favicon，已上 staging 00019-k5q）、T-0045（事故復原與重測）、使用者實測紀錄、Gate 2 r2 裁決。
- 下游：Leader（Gate 2 r2 附錄或 r3）、dev-tl（Release Notes 附註）、P1 開卡。
- 必須遵守：CLAUDE.md 協作協定；角色檔 `.claude/agents/qa-lead.md`；文件卡在 main 作業；不索取憑證，需憑證的驗證只引用使用者實測紀錄並註明來源。

## 驗收方式

Leader：核對第 1、12 項數字與引用路徑存在；`grep -n "D-018" docs/specs/24_缺陷清單.md`；`grep -n "TC-009\|TC-067" docs/specs/traceability.md | head`；抽查 §7 貼的 staging 實查輸出。

## 審核紀錄

| 輪次 | 審核者 | 結果 | 摘要 | 交接檔 |
|---|---|---|---|---|
| r1 | leader | done | 七條 acceptance 全過（D-017 closed 40/40、D-018 S2 closed、第 1 項 104/105、第 12 項證據整批更換、追溯與孤兒檢查）。裁決：A 交使用者提供 CI log、不立缺陷；B 使用者跑完整 e2e；C 追認 D-018 來源欄，07 §5.3 列框架待辦；D 建 T-0047 Release Notes 附註。 | worklog/handoff/20260920-2152-T0046-r1-leader.md |
