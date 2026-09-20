// 產生專案時程表（WBS + 甘特圖）HTML。
// 用法：node scripts/gen-schedule.mjs <設定檔.json> [cards.txt] [--date yyyy-mm-dd] [--out 路徑]
// 資料：cards.txt 由 scripts/extract-cards.sh 產生；設定檔見 docs/schedule/E-001.json。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const configPath = args[0];
if (!configPath) { console.error("用法：node scripts/gen-schedule.mjs <設定檔.json> [cards.txt] [--date yyyy-mm-dd] [--out 路徑]"); process.exit(1); }
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const cardsPath = args[1] && !args[1].startsWith("--") ? args[1] : "docs/schedule/cards.txt";
// 「現在」＝產表當下（以設定檔 tz 換算成當地時間，與任務卡／交接檔的時戳同一基準），
// 寫死進 HTML；頁面開啟時不再重新取時間，因此看報表的人看到的「現在」線永遠是產表時刻。
const tz = cfg.tz || "+08:00";
const tzMin = (() => { const m = tz.match(/^([+-])(\d\d):(\d\d)$/); return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0; })();
const generatedAtUtc = new Date();
const generatedAtLocal = new Date(generatedAtUtc.getTime() + tzMin * 60000).toISOString().slice(0, 19);
const date = opt("--date") || generatedAtLocal.slice(0, 10);
const out = opt("--out") || (cfg.output || "docs/專案時程表_{date}.html").replace("{date}", date.replace(/-/g, ""));
let mainSha = "";
try { mainSha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(); } catch { mainSha = "n/a"; }

const phaseOrder = Object.fromEntries((cfg.phases || []).map((p, i) => [p.key, i + 1]));
const phaseLabel = Object.fromEntries((cfg.phases || []).map((p) => [p.key, p.label]));
// phase 優先序：任務卡 frontmatter 的 phase → 設定檔 phaseById → phaseByTeam → team
const phaseOf = (c) => c.phase || (cfg.phaseById || {})[c.id] || (cfg.phaseByTeam || {})[c.team] || c.team;

const src = readFileSync(cardsPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
const cards = [];
for (const line of src) {
  const [id, title, team, role, status, phase, round, deps, created, updated, epic, rounds] = line.split("|");
  if (cfg.epic && epic && epic.trim() !== cfg.epic) continue;
  const segs = [];
  for (const part of (rounds || "").split(";").filter(Boolean)) {
    const [key, times] = part.split("=");
    const [s, e] = (times || "").split("~");
    const m = key.match(/^r(\d+)-(.+)$/);
    if (!m) continue;
    if (s) segs.push({ round: Number(m[1]), who: m[2], start: s, end: e || null, review: m[2] !== role });
  }
  cards.push({ id, title, team, role, status, phase: (phase || "").trim() || null, round: Number(round), deps: deps.replace(/[\[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean), created: created.replace(/\+\d\d:\d\d$/, ""), updated: updated.replace(/\+\d\d:\d\d$/, ""), segs });
}
for (const ex of cfg.extraCards || []) cards.unshift(ex);
for (const c of cards) { c.phase = phaseOf(c); if (!phaseLabel[c.phase]) { phaseLabel[c.phase] = c.phase; phaseOrder[c.phase] = 99; } }

const data = JSON.stringify({ cards, gates: cfg.gates || [], phaseLabel, phaseOrder, date, tz: cfg.tz || "+08:00", notes: cfg.notes || "", generatedAt: generatedAtUtc.toISOString(), generatedAtLocal });
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

const html = `<title>${esc(cfg.title || cfg.epic + " 專案時程表")}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --paper:#ffffff; --plane:#f5f5f2; --ink:#0b0b0b; --ink2:#52514e; --muted:#898781; --grid:#e1e0d9; --axis:#c3c2b7; --ring:rgba(11,11,11,.12);
  --plan:#2a78d6; --dev:#eb6834; --qa:#1baf7a; --leader:#4a3aa7; --gate:#d03b3b; --now:#0b0b0b; --good:#006300;
  --plan-soft:#dbe8f9; --dev-soft:#fbe3d9; --qa-soft:#d6f1e6; --leader-soft:#e2dff5;
  --font-body:"Noto Sans TC",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
}
:root[data-theme="dark"]{
  --paper:#1a1a19; --plane:#0d0d0d; --ink:#ffffff; --ink2:#c3c2b7; --muted:#898781; --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,.12);
  --plan:#3987e5; --dev:#d95926; --qa:#199e70; --leader:#9085e9; --gate:#e66767; --now:#ffffff; --good:#0ca30c;
  --plan-soft:#1c3558; --dev-soft:#4a2416; --qa-soft:#153d2e; --leader-soft:#2c2757;
}
*{box-sizing:border-box}
html{background:var(--plane)}
body{background:var(--plane);color:var(--ink);font-family:var(--font-body);font-size:13px;line-height:1.5;margin:0;padding-block:24px;padding-inline:20px}
.sheet{max-width:1400px;margin:0 auto;background:var(--paper);border:1px solid var(--ring);padding:28px 32px}
h1{font-size:22px;margin:0;letter-spacing:.01em;text-wrap:balance}
h2{font-size:15px;margin:32px 0 10px;letter-spacing:.02em;text-transform:uppercase;color:var(--ink2)}
.head{display:flex;flex-wrap:wrap;gap:16px 32px;align-items:flex-end;justify-content:space-between;border-bottom:2px solid var(--ink);padding-bottom:12px}
.meta{font-family:var(--font-mono);font-size:12px;color:var(--ink2);display:grid;grid-template-columns:auto auto;gap:2px 14px}
.meta b{color:var(--ink);font-weight:500}
.tools{display:flex;gap:8px;align-items:center}
button{font:inherit;font-size:12px;padding:6px 12px;border:1px solid var(--axis);background:var(--paper);color:var(--ink);border-radius:4px;cursor:pointer}
button:hover{border-color:var(--ink)} button:focus-visible{outline:2px solid var(--plan);outline-offset:2px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:16px}
.kpi{border:1px solid var(--grid);padding:10px 12px;color:var(--ink)}
.kpi .v{font-family:var(--font-mono);font-size:22px;font-weight:500;font-variant-numeric:tabular-nums}
.kpi .l{font-size:11px;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
.legend{display:flex;flex-wrap:wrap;gap:10px 18px;font-size:12px;color:var(--ink2);margin:10px 0 0}
.legend span{display:inline-flex;align-items:center;gap:6px}
.sw{width:22px;height:10px;border-radius:2px;display:inline-block}
.sw.rev{background:repeating-linear-gradient(135deg,transparent 0 3px,var(--ink2) 3px 4px);border:1px solid var(--ink2)}
.sw.prog{background:linear-gradient(90deg,var(--dev) 0 55%,var(--dev-soft) 55% 100%);border:1px solid var(--dev)}
.tablewrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:12px;color:var(--ink)}
th{text-align:left;font-weight:500;color:var(--ink2);border-bottom:1px solid var(--axis);padding:6px 8px;white-space:nowrap;letter-spacing:.02em}
td{border-bottom:1px solid var(--grid);padding:5px 8px;vertical-align:top;color:var(--ink)}
td.mono,th.mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap}
tr.phase td{background:var(--plane);font-weight:700;padding:8px;border-top:1px solid var(--axis);color:var(--ink)}
.pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:500;white-space:nowrap;color:var(--ink)}
.pill.plan{background:var(--plan-soft)} .pill.dev{background:var(--dev-soft)} .pill.qa{background:var(--qa-soft)} .pill.leader{background:var(--leader-soft)}
.st{font-family:var(--font-mono);font-size:11px;white-space:nowrap}
.st.done{color:var(--good)} .st.in_progress{color:var(--dev)} .st.review{color:var(--plan)} .st.todo{color:var(--muted)} .st.blocked{color:var(--gate)}
.note{font-size:12px;color:var(--ink2);margin-top:10px}
.foot{margin-top:28px;border-top:1px solid var(--axis);padding-top:10px;font-size:11px;color:var(--muted);display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between}
.gwrap{overflow-x:auto}
table.gantt{min-width:1100px;table-layout:fixed}
table.gantt th,table.gantt td{padding:0 6px;height:26px;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
table.gantt col.c-id{width:64px} table.gantt col.c-name{width:270px} table.gantt col.c-t{width:58px} table.gantt col.c-st{width:64px}
table.gantt tr.phase td{height:28px;font-weight:700;background:var(--plane);border-top:1px solid var(--axis);border-bottom:1px solid var(--grid)}
table.gantt td.name{padding-left:18px}
table.gantt td.tl{padding:0;position:relative;border-left:1px solid var(--axis)}
.axis{position:relative;height:26px}
.axis .tick{position:absolute;top:0;bottom:0;border-left:1px solid var(--grid)}
.axis .tick span{position:absolute;top:4px;left:3px;font-family:var(--font-mono);font-size:10px;color:var(--muted)}
/* 刻度含小時時，時間軸分上下兩列：上列日期（.day，每個日界一格）、下列時間（.tick）；日界線加深 */
.axis.two{height:42px}
.axis.two .day{position:absolute;top:0;height:20px;border-left:1px solid var(--axis);border-bottom:1px solid var(--grid);overflow:hidden}
.axis.two .day span{position:absolute;top:3px;left:4px;font-family:var(--font-mono);font-size:10px;color:var(--ink2);font-weight:500;white-space:nowrap}
.axis.two .tick{top:20px}
.axis.two .tick span{top:5px}
.axis .tick.d0,.tl .grid.d0{border-left-color:var(--axis)}
.tl .grid{position:absolute;top:0;bottom:0;border-left:1px solid var(--grid)}
.tl .grid.half{border-left-style:dotted}
.bar{position:absolute;top:6px;height:14px;border-radius:3px;overflow:hidden;background:var(--plane);border:1px solid var(--ring)}
.bar .fill{position:absolute;left:0;top:0;bottom:0}
.bar .lbl{position:absolute;left:6px;top:0;line-height:12px;font-family:var(--font-mono);font-size:10px;color:var(--ink);white-space:nowrap}
.bar.plan .fill{background:var(--plan)} .bar.dev .fill{background:var(--dev)} .bar.qa .fill{background:var(--qa)} .bar.leader .fill{background:var(--leader)}
.bar.plan{border-color:var(--plan)} .bar.dev{border-color:var(--dev)} .bar.qa{border-color:var(--qa)} .bar.leader{border-color:var(--leader)}
.bar.done .lbl{color:#fff}
.bar.rev{top:8px;height:10px;background:repeating-linear-gradient(135deg,transparent 0 3px,var(--ink2) 3px 4px);border:1px solid var(--ink2)}
.bar.active .fill{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.35) 0 4px,transparent 4px 8px)}
.mark{position:absolute;top:0;bottom:0;border-left:1.5px dashed var(--gate)}
.now{position:absolute;top:0;bottom:0;border-left:2px solid var(--now);z-index:2}
.axis .now span{position:absolute;top:-1px;left:4px;font-family:var(--font-mono);font-size:10px;white-space:nowrap;color:var(--now);font-weight:500;background:var(--paper);padding:0 3px}
/* 里程碑：每筆一列（tr.ms），時間軸上以菱形（.dia）標示時間位置，旁邊附時刻標籤（.dia-lbl） */
.dia{position:absolute;top:8px;width:10px;height:10px;background:var(--gate);border:1px solid var(--paper);transform:translateX(-50%) rotate(45deg);z-index:3}
.dia-lbl{position:absolute;top:6px;line-height:14px;font-family:var(--font-mono);font-size:10px;color:var(--gate);white-space:nowrap;background:var(--paper);padding:0 3px;z-index:3}
table.gantt tr.ms td.name{color:var(--gate)}
.st.ms{color:var(--gate)}
.sw.dia-sw{width:10px;height:10px;background:var(--gate);transform:rotate(45deg);border-radius:1px;margin:0 6px}
@page{size:A4 landscape;margin:10mm}
@media print{
  :root{--paper:#fff;--plane:#f3f3f0;--ink:#000}
  body{background:#fff;padding:0;font-size:11px}
  .sheet{border:0;padding:0;max-width:none}
  .tools{display:none}
  h2{margin-top:14px}
  .gantt-section{break-before:page}
  table{font-size:10px} th,td{padding:3px 6px}
  table.gantt{min-width:0;width:100%}
  *{print-color-adjust:exact;-webkit-print-color-adjust:exact}
  .kpis{grid-template-columns:repeat(6,1fr)}
}
@media (max-width:640px){ .kpis{grid-template-columns:repeat(2,1fr)} .sheet{padding:18px 16px} }
</style>
<div class="sheet">
  <div class="head">
    <div>
      <div style="font-size:11px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase">Project schedule · WBS + Gantt</div>
      <h1>${esc(cfg.title || cfg.epic + " 專案時程表")}</h1>
    </div>
    <div style="display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap">
      <div class="meta">
        <span>日期</span><b>${esc(date)}（${esc(cfg.tz || "+08:00")}）</b>
        <span>Epic 狀態</span><b>${esc(cfg.epicStatus || "")}</b>
        <span>main</span><b>${esc(mainSha)}</b>
        ${cfg.staging ? "<span>staging</span><b>" + esc(cfg.staging) + "</b>" : ""}
      </div>
      <div class="tools">
        <button id="theme" type="button" aria-pressed="false">深色模式</button>
        <button id="print" type="button">列印</button>
      </div>
    </div>
  </div>
  <div class="kpis" id="kpis"></div>

  <h2>WBS 工作分解表</h2>
  <div class="tablewrap"><table id="wbs">
    <thead><tr><th>卡號</th><th>標題</th><th>團隊／角色</th><th>依賴</th><th>回合</th><th class="mono">派工</th><th class="mono">完成</th><th class="mono">歷時</th><th>狀態</th></tr></thead>
    <tbody></tbody>
  </table></div>
  <p class="note">派工時間取該卡第 1 輪交接檔 A 段的開工時間（無交接檔者取任務卡建立時間）；完成時間取判 done 時任務卡的 updated；歷時為兩者之差（含等待審核）。逐輪細節見 <code>worklog/handoff/</code>。</p>

  <div class="gantt-section">
    <h2 id="gtitle">甘特圖</h2>
    <div class="legend">
      <span><i class="sw" style="background:var(--leader)"></i>Leader</span>
      <span><i class="sw" style="background:var(--plan)"></i>規劃團隊</span>
      <span><i class="sw" style="background:var(--dev)"></i>開發團隊</span>
      <span><i class="sw" style="background:var(--qa)"></i>測試團隊</span>
      <span><i class="sw prog"></i>長條＝實際時段，填滿比例＝進度</span>
      <span><i class="sw rev"></i>審核回合</span>
      <span><i class="sw dia-sw"></i>里程碑（每筆一列，菱形＝時間位置；虛線為其貫穿全圖的對齊線）</span>
      <span><i class="sw" style="background:transparent;border-left:2px solid var(--now);width:0;height:12px"></i>現在（＝產表時刻）</span>
    </div>
    <div class="gwrap" style="margin-top:8px"><table class="gantt" id="gantt">
      <colgroup><col class="c-id"><col class="c-name"><col class="c-t"><col class="c-t"><col class="c-st"><col></colgroup>
      <thead>
        <tr><th>卡號</th><th>階段 ／ 任務</th><th class="mono">派工</th><th class="mono">完成</th><th>狀態</th><th style="padding:0"><div class="axis" id="axis"></div></th></tr>
      </thead>
      <tbody></tbody>
    </table></div>
    <p class="note">長條範圍＝執行者實際工作時段（A 段開工 → B 段完工；進行中者到「現在」，即產表時刻）；填滿比例＝進度（完成 100%、審核中 90%、進行中 50%、待辦 0%）。斜線細條＝審核者的審核時段。${esc(cfg.notes || "")}</p>
  </div>

  <div class="foot">
    <span>產出：Leader · 資料來源：tasks/T-*.md frontmatter 與 worklog/handoff/ 各輪 A／B 段 · 產生器 scripts/gen-schedule.mjs</span>
    <span id="gen"></span>
  </div>
</div>
<script>
const DATA = ${data};
const fmtT = (iso) => iso ? iso.slice(11,16) : "—";
const fmtD = (iso) => iso ? iso.slice(5,10) : "";
const mins = (a,b) => (new Date(b) - new Date(a)) / 60000;
const dur = (m) => m < 60 ? Math.round(m) + " 分" : m < 1440 ? (m/60).toFixed(1) + " 時" : (m/1440).toFixed(1) + " 天";
const teamName = { leader:"Leader", plan:"規劃", dev:"開發", qa:"測試" };
const stName = { done:"done", in_progress:"進行中", review:"審核中", todo:"待辦", blocked:"阻塞", cancelled:"取消" };
const startOf = (c) => { const w = c.segs.find(s => !s.review); return w ? w.start : c.created; };
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;");

const root = document.documentElement, tbtn = document.getElementById("theme");
const applyTheme = (t) => { if (t === "dark") root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme"); tbtn.textContent = t === "dark" ? "淺色模式" : "深色模式"; tbtn.setAttribute("aria-pressed", t === "dark"); };
let theme = "light"; try { theme = localStorage.getItem("schedule-theme") || "light"; } catch (e) {}
applyTheme(theme);
tbtn.addEventListener("click", () => { theme = theme === "dark" ? "light" : "dark"; applyTheme(theme); try { localStorage.setItem("schedule-theme", theme); } catch (e) {} });
document.getElementById("print").addEventListener("click", () => window.print());

const cards = DATA.cards;
const done = cards.filter(c => c.status === "done");
const kp = [
  ["任務卡", cards.length], ["已完成", done.length], ["進行中／審核中", cards.filter(c => c.status==="in_progress"||c.status==="review").length],
  ["總回合數", cards.reduce((s,c) => s + c.round, 0)], ["達 3 輪上限", cards.filter(c => c.round>=3).length], ["已完成卡歷時合計", dur(done.reduce((s,c) => s + mins(startOf(c), c.updated), 0))]
];
document.getElementById("kpis").innerHTML = kp.map(([l,v]) => '<div class="kpi"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>').join("");

const byPhase = {};
for (const c of cards) (byPhase[c.phase] ||= []).push(c);
const phases = Object.keys(byPhase).sort((a,b) => (DATA.phaseOrder[a]||99) - (DATA.phaseOrder[b]||99));
const sorted = (arr) => arr.slice().sort((a,b)=>a.id.localeCompare(b.id));

let rows = "";
for (const p of phases) {
  rows += '<tr class="phase"><td colspan="9">'+esc(DATA.phaseLabel[p])+'</td></tr>';
  for (const c of sorted(byPhase[p])) {
    const s = startOf(c), e = c.status === "done" ? c.updated : null;
    rows += '<tr><td class="mono">'+c.id+'</td><td>'+esc(c.title)+'</td><td><span class="pill '+c.team+'">'+(teamName[c.team]||c.team)+'</span> '+c.role+'</td><td class="mono">'+(c.deps.join(", ")||"—")+'</td><td class="mono">'+c.round+'</td><td class="mono">'+fmtT(s)+'</td><td class="mono">'+fmtT(e)+'</td><td class="mono">'+(e?dur(mins(s,e)):"—")+'</td><td><span class="st '+c.status+'">'+(stName[c.status]||c.status)+'</span></td></tr>';
  }
}
document.querySelector("#wbs tbody").innerHTML = rows || '<tr><td colspan="9" style="color:var(--muted)">尚無任務卡。建卡後執行 scripts/extract-cards.sh 再重新產生本表。</td></tr>';

// 時間範圍：資料最早開工 → 最晚完工／產表時刻，向外取整到小時；跨 36 小時改 6 小時刻度，跨 5 天改日刻度
// 「現在」線固定為產表時刻（DATA.generatedAtLocal，產生器以設定檔 tz 換算），不是開啟頁面的時間。
const localIso = (d) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,19);
const nowIso = DATA.generatedAtLocal;
const times = [];
for (const c of cards) { for (const s of c.segs) { if (s.start) times.push(s.start); if (s.end) times.push(s.end); } if (c.status !== "todo") times.push(c.created); if (c.status === "done") times.push(c.updated); }
for (const g of DATA.gates) times.push(g.t);
// 產表時刻一律納入範圍：「現在」線永遠可見，最後一筆完工到產表之間的空白就是「無事發生」的時段。
times.push(nowIso);
const tMin = new Date(times.reduce((a,b) => a < b ? a : b)), tMax = new Date(times.reduce((a,b) => a > b ? a : b));
const T0 = new Date(tMin); T0.setMinutes(0,0,0);
const T1 = new Date(tMax); T1.setMinutes(0,0,0); T1.setHours(T1.getHours() + 1);
const spanH = (T1 - T0) / 3600000;
const hourStep = spanH <= 36 ? 1 : spanH <= 120 ? 6 : 0;
const dayMode = hourStep === 0;
const pct = (d) => Math.max(0, Math.min(100, ((new Date(d) - T0) / (T1 - T0)) * 100));
document.getElementById("gtitle").textContent = "甘特圖 · " + localIso(T0).slice(0,16).replace("T"," ") + " – " + localIso(T1).slice(0,16).replace("T"," ");
const showNow = nowIso >= localIso(T0) && nowIso <= localIso(T1);

const ticks = [];
if (dayMode) { const d = new Date(T0); d.setHours(0,0,0,0); for (; d <= T1; d.setDate(d.getDate()+1)) ticks.push({ t: localIso(d), label: localIso(d).slice(5,10), half: null }); }
else { const d = new Date(T0); d.setHours(Math.floor(d.getHours()/hourStep)*hourStep, 0, 0, 0); for (; d <= T1; d.setHours(d.getHours()+hourStep)) { const h = new Date(d); const iso = localIso(h); ticks.push({ t: iso, label: iso.slice(11,16), d0: h.getHours() === 0, half: hourStep === 1 ? localIso(new Date(h.getTime()+1800000)) : null }); } }
// 上列日期格：每個涵蓋到的日曆日一格，從該日 00:00（早於 T0 者貼齊左緣）延伸到下一個日界。
const days = [];
if (!dayMode) { const d = new Date(T0); d.setHours(0,0,0,0); for (; d <= T1; d.setDate(d.getDate()+1)) { const iso = localIso(d); const next = new Date(d); next.setDate(next.getDate()+1); days.push({ t: iso, label: iso.slice(0,10), end: localIso(next) }); } }

let axis = "";
const axisEl = document.getElementById("axis");
if (!dayMode) axisEl.classList.add("two");
for (const dy of days) axis += '<div class="day" style="left:'+pct(dy.t)+'%;width:'+(pct(dy.end)-pct(dy.t))+'%"><span>'+dy.label+'</span></div>';
for (const tk of ticks) axis += '<div class="tick'+(tk.d0?' d0':'')+'" style="left:'+pct(tk.t)+'%"><span>'+tk.label+'</span></div>';
for (const g of DATA.gates) axis += '<div class="mark" style="left:'+pct(g.t)+'%"></div>';
if (showNow) axis += '<div class="now" style="left:'+pct(nowIso)+'%"><span>現在 '+(hourStep === 1 ? "" : fmtD(nowIso)+" ")+fmtT(nowIso)+'</span></div>';
document.getElementById("axis").innerHTML = axis;

const gridCells = () => {
  let g = "";
  for (const tk of ticks) { g += '<div class="grid'+(tk.d0?' d0':'')+'" style="left:'+pct(tk.t)+'%"></div>'; if (tk.half) g += '<div class="grid half" style="left:'+pct(tk.half)+'%"></div>'; }
  for (const gt of DATA.gates) g += '<div class="mark" style="left:'+pct(gt.t)+'%"></div>';
  if (showNow) g += '<div class="now" style="left:'+pct(nowIso)+'%"></div>';
  return g;
};

let grows = "";
// 里程碑群組：每筆一列，卡號欄以 M-01… 編號；派工欄留「—」、完成欄填時刻；時間軸以菱形標示，
// 標籤靠右放，靠近右緣（>82%）時改放左側以免溢出。
if (DATA.gates.length) {
  grows += '<tr class="phase"><td></td><td colspan="4">里程碑（關卡／事件）</td><td class="tl">'+gridCells()+'</td></tr>';
  DATA.gates.forEach((g, i) => {
    const p = pct(g.t);
    const lbl = (hourStep === 1 ? "" : fmtD(g.t)+" ") + fmtT(g.t);
    const lblPos = p > 82 ? 'right:calc('+(100-p)+'% + 9px)' : 'left:calc('+p+'% + 9px)';
    grows += '<tr class="ms"><td class="mono">M-'+String(i+1).padStart(2,"0")+'</td><td class="name" title="'+esc(g.label)+'">'+esc(g.label)+'</td><td class="mono">—</td><td class="mono">'+fmtT(g.t)+'</td><td><span class="st ms">里程碑</span></td><td class="tl">'+gridCells()+'<div class="dia" style="left:'+p+'%" title="'+esc(g.label)+' '+fmtD(g.t)+' '+fmtT(g.t)+'"></div><span class="dia-lbl" style="'+lblPos+'">'+lbl+'</span></td></tr>';
  });
}
for (const p of phases) {
  grows += '<tr class="phase"><td></td><td colspan="4">'+esc(DATA.phaseLabel[p])+'</td><td class="tl">'+gridCells()+'</td></tr>';
  for (const c of sorted(byPhase[p])) {
    const s = startOf(c), e = c.status === "done" ? c.updated : null;
    let bars = gridCells();
    const workSegs = c.segs.filter(x => !x.review && x.start);
    const bStart = workSegs.length ? workSegs[0].start : (c.status === "todo" ? null : c.created);
    let bEnd = null;
    if (c.status === "done") bEnd = c.updated;
    else if (workSegs.length && workSegs[workSegs.length-1].end) bEnd = workSegs[workSegs.length-1].end;
    else if (c.status === "in_progress" || c.status === "review") bEnd = nowIso;
    if (bStart && bEnd) {
      const l = pct(bStart), w = Math.max(0.6, pct(bEnd) - l);
      const prog = c.status === "done" ? 100 : c.status === "review" ? 90 : c.status === "in_progress" ? 50 : c.status === "blocked" ? 30 : 0;
      const label = c.status === "done" ? "100%" : (stName[c.status] || c.status);
      bars += '<div class="bar '+c.team+' '+c.status+(c.status==="in_progress"?" active":"")+'" style="left:'+l+'%;width:'+w+'%" title="'+c.id+' '+fmtD(bStart)+' '+fmtT(bStart)+'–'+fmtT(bEnd)+'"><div class="fill" style="width:'+prog+'%"></div><span class="lbl">'+label+'</span></div>';
    }
    for (const r of c.segs.filter(x => x.review && x.start)) {
      const l = pct(r.start), w = Math.max(0.5, pct(r.end || nowIso) - l);
      bars += '<div class="bar rev" style="left:'+l+'%;width:'+w+'%" title="'+c.id+' r'+r.round+' 審核 '+r.who+' '+fmtT(r.start)+'–'+fmtT(r.end)+'"></div>';
    }
    grows += '<tr><td class="mono">'+c.id+'</td><td class="name" title="'+esc(c.title)+'">'+esc(c.title)+'</td><td class="mono">'+fmtT(s)+'</td><td class="mono">'+fmtT(e)+'</td><td><span class="st '+c.status+'">'+(stName[c.status]||c.status)+'</span></td><td class="tl">'+bars+'</td></tr>';
  }
}
document.querySelector("#gantt tbody").innerHTML = grows || '<tr><td colspan="5" style="color:var(--muted)">尚無任務卡</td><td class="tl">' + gridCells() + '</td></tr>';
document.getElementById("gen").textContent = "產表時刻 " + DATA.generatedAtLocal.replace("T"," ").slice(0,16) + "（" + DATA.tz + "）· 「現在」線＝產表時刻，非開啟頁面的時間 · 資料快照 " + DATA.generatedAt.replace("T"," ").slice(0,16) + " UTC";
</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html, "utf8");
console.log("written", out, html.length, "bytes;", cards.length, "cards; range auto");
