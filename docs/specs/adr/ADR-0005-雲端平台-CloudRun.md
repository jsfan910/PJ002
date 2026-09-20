---
doc: ADR
id: ADR-0005
title: staging 雲端平台改為 Google Cloud Run（Docker 映像，min instances = 0）＋ Neon Postgres（Free）；映像存 Artifact Registry；CI/CD 維持 GitHub Actions
status: accepted
supersedes: ADR-0003
author: plan-sd
date: 2026-09-19
---

# ADR-0005：staging 雲端平台改為 Google Cloud Run（Docker 映像，min instances = 0）＋ Neon Postgres（Free）；映像存 Artifact Registry；CI/CD 維持 GitHub Actions

<!-- 檔名：docs/specs/adr/ADR-0005-雲端平台-CloudRun.md -->
<!-- 本 ADR 取代 ADR-0003。ADR-0003 已標記 superseded(by ADR-0005)，僅供歷史查閱。 -->

## 背景

### 為什麼現在重開這個決策

`ADR-0003` 在 2026-09-19 選了 Render Web Service（Free 方案）。當時的選項表中 **D. Google Cloud Run ＋ Neon 是被評估過並否決的**，否決的理由只有兩條：

1. **必須先啟用計費帳戶並綁信用卡**才能使用（即使實際不扣款）；
2. IAM 與服務帳號設定步驟多，對 DevOps 1–2 張卡與 NFR-008 的 15 分鐘門檻有壓力。

2026-09-19T07:29:49+08:00，**使用者裁決**（見 `tasks/E-001-todo-app.md#Leader 裁決紀錄`）把部署平台改為 GCP Cloud Run、資料庫維持 Neon Free。裁決理由三條：

- **冷啟 1–3 秒優於 30–50 秒**；
- **Cloud Run revision 切流量的回滾優於 Render 的 Dashboard 回滾**；
- **費用維持 US$0**（min instances = 0）。

換句話說：**否決理由 1（綁卡）已由使用者主動承擔並解除**——使用者明示會自行準備 GCP 專案與計費帳戶。否決理由 2（IAM 設定成本）仍然存在，本 ADR 必須正面處理，不能假裝它消失了（處理方式見「決定」第 5 點與「後果」）。

這不是「當初選錯了」，而是**約束變了**：ADR-0003 在「不得綁卡」的前提下是正確的決策，該前提解除後，同一套評分自然指向不同答案。這也是 ADR-0003 被標為 `superseded` 而非 `rejected` 的原因。

### 不變的限制

1. **免費額度可部署**（Epic 限制）。費用必須維持 US$0。
2. **憑證與雲端帳號由使用者提供，agent 不得索取或代填**（Epic 限制）。
3. **可離線驗證**：本機 `docker build` 就要能驗掉雲端建置的絕大部分失敗原因。
4. **CI/CD 用 GitHub Actions**（Epic 限制，不是本 ADR 的選項）。
5. 指令須可在 Windows 11 的 Git Bash 或 PowerShell 執行。
6. DevOps 只有 **1–2 張工作卡**的預算。
7. **O-004（Leader 裁決）**：前端與 API 同源，平台上只需**一個**對外服務。
8. **ADR-0001（Node.js 22 ＋ Fastify）、ADR-0002（Neon Postgres ＋ `pg` ＋ forward-only migration）、ADR-0004（應用層 Basic Auth、`/health` 唯一豁免、不啟用 CORS）全部不變。** 同一份 `Dockerfile`、同一個映像。

### 對應 NFR／AC

- **AC-010-2／BR-025／NFR-002①**：一律 HTTPS，HTTP 須導向 HTTPS。
- **AC-010-3／NFR-006**：重新部署後資料仍在。
- **AC-010-5／NFR-003**：`/health` 回 200；連續監測成功率 ≥ 99%（每 5 分鐘一次）；單次部署造成的不可用時間 < 60 秒。Gate 2 採 **24 小時**採樣（Leader 對 O-009 的裁決）。
- **NFR-001**：P95 < 500ms／10 併發。
- **NFR-008**：未參與者 15 分鐘內在本機跑起來，並可重現一次 staging 部署。

## 選項

| 選項 | 優點 | 缺點 | 成本 |
|---|---|---|---|
| **A. Cloud Run（min instances = 0）＋ Neon Serverless Postgres（Free）** ← 採用 | **容器原生**：直接跑本機 `docker build` 出來的同一個映像，離線驗證的有效性與 Render 相同（甚至更高，因為連 base image 與執行期都一致）；**冷啟 1–3 秒**，比 Render Free 的 30–50 秒快一個量級，NFR-001 的離群值風險大幅下降；**revision 模型**：每次部署產生一個不可變 revision，回滾是 `gcloud run services update-traffic --to-revisions=<prev>=100`，**秒級生效、不需重新建置**，直接服務 NFR-003；平台自動提供 `*.run.app` 的 **HTTPS 憑證並拒絕明文 HTTP**（AC-010-2／BR-025 零程式碼）；**流量切換內建**：新 revision 啟動失敗時舊 revision 繼續服務 100% 流量，零停機；運算與資料分離（Neon 為外部託管），NFR-006 由架構保證；`gcloud run deploy` 一行即可部署，pipeline 不需第三方 Action；免費額度對本案用量而言餘裕極大 | **必須先啟用計費帳戶（綁信用卡）**，即使實際不扣款——使用者已於裁決中承擔；IAM／Workload Identity Federation 的一次性設定比 Render 的一個 Deploy Hook URL 多約 6 個步驟；`gcloud` CLI 在 Windows 需額外安裝（僅本機手動操作需要，CI 端的 runner 已內建 `google-github-actions/setup-gcloud`）；min instances = 0 是免費的前提，**設成 1 就會產生持續的 vCPU／記憶體費用** | **US$0**。Cloud Run 每月免費額度：200 萬次請求、360,000 GB-秒記憶體、180,000 vCPU-秒；Artifact Registry 每月 0.5 GB 儲存免費。本案用量（監測每日 288–576 次請求＋UAT 手動操作）遠低於額度。Neon Free 0.5 GB 無到期日 |
| B. Cloud Run（min instances = 0）＋ Cloud SQL for PostgreSQL | 資料庫與運算同一個雲、同一個 IAM 體系，連線可走 Cloud SQL Auth Proxy／Unix socket，不需在網際網路上開 Postgres 埠；備份與時間點還原是平台內建功能，比 Neon Free 的短保留窗可靠 | **Cloud SQL 沒有免費額度**：最小的 `db-f1-micro`（共享 vCPU、0.6 GB RAM、10 GB HDD）約 **US$8–10／月**，直接違反 Epic 的「免費額度可部署」硬約束；且要推翻 ADR-0002（Neon）與 `05_資料庫設計.md` 的連線方式，變更面積遠大於本次規格變更的授權範圍；Cloud SQL 實例**不會自動停機**，忘記關就持續計費 | **約 US$8–10／月**，不符硬約束 |
| C. 維持 Render Web Service（Free）＋ Neon Free（即 ADR-0003 現狀） | **零變更成本**：06 與 SD 不需改寫，dev-ops 可立刻開卡；不需綁信用卡；`render.yaml` 已設計完成；Deploy Hook 是所有選項中最簡單的部署介面（一行 `curl`） | **冷啟 30–50 秒**且無法消除，只能靠 5 分鐘監測保溫；一旦監測工作流本身失效超過 15 分鐘，驗收者就會撞上一次數十秒的白畫面（SD-04 已列為殘留風險）；回滾必須**人工進 Render Dashboard 點按**，無 CLI、無法寫進工作流，目標 < 2 分鐘靠的是人手速度；**使用者已明確裁決不採此項** | US$0 |
| D. Compute Engine `e2-micro` 永久免費 VM ＋ Neon Free | 每月有永久免費的 `e2-micro`（美國特定區域）；**完全無冷啟**，程序常駐；可完全掌控執行環境 | 回到**自管虛擬機**：要自己裝 Docker、自己設 systemd、自己接 TLS 憑證（Let's Encrypt ＋ 自動更新）、自己做零停機輪替——AC-010-2 與 NFR-003 從「平台提供」變成「團隊自行實作」，是三處新的出錯點；免費區域限美國，對台灣使用者的 RTT 比 `asia-east1` 高；DevOps 1–2 張卡完全吃不下；與「規模刻意小」的取向相反 | US$0（但工作量最高） |

註：Cloudflare Workers ＋ D1（ADR-0003 的選項 C）與 Vercel／Netlify（選項 E）本次**不重新評估**——它們的否決理由是「非標準 Node.js 執行環境／需要 adapter，會推翻 ADR-0001 與 ADR-0004」，與本次變更的約束（綁卡與否）無關，理由完全未變。Fly.io（選項 B）的否決理由之一正是綁卡，該理由已解除，但其 Fly Postgres 自管叢集的缺點仍在，且使用者已明確指定 GCP，故不再列入。

## 決定

**選 A：staging 部署於 Google Cloud Run（單一服務、Docker 映像、`min instances = 0`、`max instances = 2`、同時供應單頁前端與 API），映像存放於 Artifact Registry，資料庫維持 Neon Serverless Postgres（Free，ADR-0002 不變）。CI/CD 維持 GitHub Actions，以 `gcloud run deploy` 部署，認證採 Workload Identity Federation。**

理由，逐條對上限制：

1. **費用維持 US$0（限制 1）**：`min instances = 0` 時，沒有請求就沒有執行中的容器，不產生 vCPU／記憶體計費；本案的請求量（監測每日 288–576 次、UAT 手動操作數百次）距離每月 200 萬次請求的免費額度有三個數量級的餘裕。映像單一、約 150 MB，在 Artifact Registry 的 0.5 GB 免費儲存內（保留策略見「後果」）。**`min instances = 0` 不是效能取捨，是免費的必要條件，不得為了消除冷啟而調高。**
2. **離線驗證（限制 3）**：Cloud Run 吃的就是本機 `docker build` 產出的**同一個映像**（透過 Artifact Registry 傳遞），不是「同一份 Dockerfile 在雲端重建」。這比 ADR-0003 的 Render Docker runtime 又強一階：連 base image 的 digest 都一致，「本機能跑、雲端不能跑」的可能性被壓到最低。
3. **回滾（NFR-003，使用者裁決理由之二）**：每次 `gcloud run deploy` 產生一個不可變的 revision。回滾是把流量切回上一個 revision，**不重新建置、不重新拉映像**，數秒內生效，且**可以寫進工作流或一行 CLI**，不依賴人工點按 Dashboard。這是本次變更相對 Render 最實質的收穫。
4. **冷啟（使用者裁決理由之一）**：Cloud Run 的冷啟是「拉起一個已在本地快取的容器」，典型 **1–3 秒**；Render Free 的冷啟是「從休眠喚醒整個服務實例」，30–50 秒。差一個量級。保溫策略仍保留（見第 6 點），但**性質從「必要的遮蔽手段」降級為「錦上添花」**——即使保溫完全失效，使用者撞上的也只是 1–3 秒，不再是需要在文件中警告的殘留風險。SD-04 據此改寫。
5. **正面處理 IAM 設定成本（ADR-0003 否決理由 2，本 ADR 不假裝它消失）**：
   - 採 **Workload Identity Federation（WIF）** 作為 GitHub Actions 對 GCP 的認證主線：GitHub 簽發的 OIDC token 直接換取 GCP 短期憑證，**倉庫中不存在任何長期金鑰**。一次性設定約 6 個步驟（建立 workload identity pool → provider → 服務帳號 → 綁定 repo → 授 3 個角色 → 記下 4 個字串）。
   - **保留服務帳號 JSON 金鑰作為備選**：若使用者在 WIF 設定上卡關超過 15 分鐘（NFR-008 的門檻），改用 `GCP_SA_KEY` secret 即可完成部署。備選路徑的代價（長期憑證、需手動輪替）寫在 `06_部署架構與CICD.md` 第 3 章。**有備選路徑，才不會讓一個一次性設定阻擋整條交付。**
   - 一次性設定的逐步指令由 **dev-ops 寫進 README**（Git Bash 與 PowerShell 兩種寫法，Epic 限制），`gcloud` CLI 只在使用者做這次一次性設定時需要；日常部署全在 CI runner 上，runner 已內建 `gcloud`。
6. **保溫（降低冷啟命中率）**：以 **GitHub Actions cron 定時打 `/health`** 維持實例存活。頻率：NFR-003 的量測工作流本身即為保溫來源（每 5 分鐘一次，Leader 對 O-009 的裁決，不得自行更動）；若倉庫必須為私有而需節流 Actions 分鐘數，**降為每 10 分鐘仍足以保溫**——因為 Cloud Run 沒有 Render Free 那種「15 分鐘休眠門檻」，保溫只是把冷啟的命中機率壓低，而冷啟本身只有 1–3 秒。**不引入 Cloud Scheduler**：它會多一個 GCP 資源、多一組 IAM 綁定，而 GitHub Actions 的排程已經在用、已經免費、已經在同一個地方觀測。

   > **附註（T-0040，2026-09-20）**：本點寫「NFR-003 的量測工作流本身即為保溫來源」這個前提**已不成立**。GitHub Actions 的 `schedule` 在 24 小時窗內實測只觸發 **8 次／理論約 258 次（約 3%）**，NFR-003 的量測來源已於 T-0031 改為 **Cloud Monitoring uptime check**，`monitor-health.yml` 於 T-0040 定位為「保溫與人工抽查用，**不具備援能力**」（`06` §3.3、§6.1）。**本決定的結論不變**（仍不引入 Cloud Scheduler），但理由要更正：實際承擔保溫的是每 5 分鐘從 4 個地區打 `/health` 的 uptime check，不是 cron。另：「NFR-003 的量測來源只剩單一 uptime check」形成的備援缺口與三個處置選項，列於 `06` §6.1「備援缺口」，待 Leader 裁決。
7. **HTTPS（AC-010-2／BR-025）**：Cloud Run 為 `*.run.app` 自動配發並更新憑證，且**預設不接受明文 HTTP**（HTTP 請求由 Google 前端以 **3xx** 導向 HTTPS）。與 ADR-0003 相同，團隊零程式碼。

   > **附註（T-0040，2026-09-20，規格變更請求）**：本點原文寫「由 Google 前端以 **301** 導向 HTTPS」，**該狀態碼字面與實測不符**。qa-at 於 r3（2026-09-19T17:19）與 qa-lead 於 T-0030（2026-09-19T17:32）各自獨立實測 `curl -sSI "http://todo-app-dpevsdhdva-de.a.run.app/health"`，兩次皆得 **`HTTP/1.1 302 Found`**，`location: https://todo-app-dpevsdhdva-de.a.run.app/health`。
   >
   > **判準據此改為：回 `3xx`（301 或 302 皆視為合規）且 `Location` 為對應的 `https://` 網址。** 依據 `docs/specs/24_缺陷清單.md#D-016`（已 closed，登錄為「規格文字待修」而非產品缺陷）與 **Leader 2026-09-19T17:30:10 裁決①「接受 302 等效（意圖是強制 HTTPS），TC-079 判通過並註記」**。
   >
   > **為什麼不改成寫死 302**：導向狀態碼是 Google 前端的平台行為，團隊零程式碼可改、亦無平台承諾其不變；把判準綁在單一狀態碼上，等於讓規格對一個我們不控制的實作細節做出承諾——這次是 301 寫成 302，下次就是 302 寫成 308。**規範意圖是「明文 HTTP 不得直接服務、必須被導到 HTTPS」，判準就該寫到這個層級為止。**
   >
   > 連帶影響：`06_部署架構與CICD.md` §2 資源表已同步（T-0040，version 0.3）；`20_測試案例.md` TC-079 判準由 qa-lead 於下一輪測試計畫同步卡處理；`03_系統設計書_SD.md` §7 NFR-002① 尚有「301」字面，非 T-0040 的 outputs 範圍，已列該卡交接檔「下一步建議」；`01_需求規格書_SRS.md` 實查無「301」字面（NFR-002 原文即寫「觀察 3xx 導向」），無須修正。
8. **區域**：`asia-east1`（台灣）。理由：對本案使用者 RTT 最低，且 Artifact Registry 放同一區域可免跨區流量費。Neon 的區域由使用者於建立專案時選擇，建議同樣選擇亞太區以壓低 DB RTT（不強制，因 Neon Free 的區域選項與 GCP 不完全對齊）。
9. **與 ADR-0004 完全相容**：Basic Auth 仍是應用層 Fastify 全域 `onRequest` hook、`/health` 仍是唯一豁免路徑、仍不註冊 CORS。Cloud Run 不提供也不需要平台級存取保護。`/health` 同時作為 Cloud Run 的 startup probe 路徑。

## 後果

### 必須先做、否則整條路徑不通（使用者的一次性前置）

- **必須啟用計費帳戶並綁定信用卡**，即使實際費用為 US$0。這是 GCP 使用 Cloud Run 與 Artifact Registry 的硬性前提，**沒有繞過的方法**。使用者已於裁決中明確承擔此代價。
- 必須在 GCP 專案中**啟用 API**：`run.googleapis.com`、`artifactregistry.googleapis.com`、`iamcredentials.googleapis.com`、`sts.googleapis.com`。
- 必須自行完成 WIF（或服務帳號金鑰）的設定，並把產出的字串填進 GitHub secrets／variables。**agent 不索取、不代填**；`06_部署架構與CICD.md` 第 4 章只列名稱與用途。
- **費用護欄**：建議使用者在計費帳戶上設一個 US$1 的預算警示。理由：免費額度是「用量門檻」不是「硬上限」，超過即計費。本案用量離門檻極遠，但護欄的成本是一次點擊。

### 正面

- **回滾從人工操作變成一行指令**：`gcloud run services update-traffic <svc> --to-revisions=<prev>=100 --region=asia-east1`，秒級生效、不重新建置。`06` 第 5.1 節據此改寫，目標時間維持 < 2 分鐘且**這次真的有餘裕**。
- **冷啟 1–3 秒**（原 30–50 秒）。NFR-001 的暖身規定仍保留（成本為零、對 Neon 冷啟仍有意義），但冷啟不再是 NFR-003 的主要誤報來源，SD-04 的風險等級實質下降。
- **映像不可變且可追溯**：Artifact Registry 中每個映像以 commit SHA 標記，「線上跑的是哪一版」有單一可查來源；revision 與映像一一對應。
- **建置與執行的環境完全一致**：CI 建置的映像就是雲端執行的映像，不存在「雲端重新建置時裝到不同版本」的漂移。
- 運算與資料仍完全分離（Neon 為外部託管），NFR-006 仍由架構保證，與 ADR-0002 零衝突。
- HTTPS、憑證更新、HTTP 導向、零停機流量切換四項仍由平台提供，團隊零程式碼。

### 負面／要承擔的

- **計費帳戶是硬前提**（如上）。這是本決策付出的主要代價，不隱藏。
- **IAM／WIF 的一次性設定比 Deploy Hook 複雜**：從「複製一個 URL」變成「約 6 個步驟、4 個字串」。承擔方式：dev-ops 在 README 寫逐步指令（兩種 shell），並保留服務帳號金鑰作為卡關時的備選路徑。**若 NFR-008 的 15 分鐘實測因此不通過，這是必須回報 Leader 的事實，不得以「照著做就好」帶過。**
- **`min instances = 0` 與冷啟是綁在一起的**：想消除冷啟就要把 min instances 設成 1，那會產生持續的 vCPU／記憶體費用，違反免費硬約束。**因此冷啟 1–3 秒是刻意承擔的、不修的**。任何人想調高 min instances，視為規格變更。
- **Artifact Registry 的儲存會累積**：每次部署推一個映像，0.5 GB 免費額度約可放 3–4 個未壓縮映像層集合。對策：dev-ops 在 repository 上設**清理政策（cleanup policy）保留最近 5 個版本**，或於部署工作流末端刪除 5 個版本以前的映像。**回滾依賴舊映像存在，因此保留數不得少於 3**（`06` 第 5.2 節的「舊映像已被清理」備選路徑即為此而留）。
- **平台鎖定程度低但非零**：`gcloud run deploy` 的參數與 WIF 設定是 GCP 專屬。緩解與 ADR-0003 相同：應用本身只依賴 `Dockerfile` 與環境變數，換平台時應用程式碼不動。`infra/render.yaml` 由 dev-ops 於骨架卡改為 GCP 的等價設定（或直接以工作流中的 `gcloud run deploy` 參數為唯一事實來源，不再維護獨立的 IaC 檔）——**此項留給 dev-ops 於骨架卡決定並記錄在該卡**。
- **無 SLA**：Cloud Run 免費額度內不提供可用性保證。NFR-003 的 99% 仍是團隊的自我量測目標，不是平台承諾。判讀規則（未達標時先區分應用缺陷或平台事件）維持，判讀依據改為 Cloud Run 的內建指標與 revision 事件紀錄。
- **`gcloud` CLI 在 Windows 需額外安裝**：僅使用者做一次性設定與手動回滾時需要。CI 端不需要（`google-github-actions/setup-gcloud` 提供）。手動回滾亦可在 Cloud Console 的 Revisions 頁面以 UI 完成，故 `gcloud` 不是回滾的必要條件。

### 對其他文件的影響

- **ADR-0003**：標記 `superseded(by ADR-0005)`，文末加一行取代說明。**內容不改寫**——它記錄的是「在不得綁卡的前提下」的正確決策，改寫它等於湮滅決策脈絡。僅供歷史查閱。
- **`06_部署架構與CICD.md`**：第 1 章環境清單網址、第 2 章雲端資源清單、第 3 章 pipeline（build → push → deploy）、第 4 章環境變數、第 5 章回滾、第 6 章監控，全數依本 ADR 改寫（T-0010）。
- **`03_系統設計書_SD.md`**：第 1.2 節容器圖邊界、第 2 章技術選型表雲端列、第 7 章 NFR-001／002／003／006 的對策與驗證方式、第 9 章 SD-04（T-0010）。
- **`04_API規格.yaml`**：`servers` 的 staging 網址由 `https://<service>.onrender.com` 改為 Cloud Run 的 `*.run.app` 網址。**該值本來就是佔位符、由使用者部署後填入**，且本次規格變更未授權改動 API 規格，故**留給 dev-ops 於骨架卡回填**（`06` 第 1 章已註明）。
- **`05_資料庫設計.md`**：無影響（Neon 不變，ADR-0002 不變）。
- **`01_需求規格書_SRS.md`、`02_系統分析書_SA.md`、`docs/specs/traceability.md`**：無影響（需求與分析不含平台名稱）。
- **ADR-0001、ADR-0002**：無影響。
- **ADR-0004**：僅「Render」名詞替換為「Cloud Run」，決策內容與判準一字未改。
