import { readFileSync, writeFileSync } from "node:fs";

const srcPath = process.argv[3] || (process.env.TEMP + "/cards.txt");
const src = readFileSync(srcPath, "utf8").trim().split(/\r?\n/);
const out = process.argv[2];

const phaseOf = (id, team) => {
  const n = Number(id.slice(2));
  if (n === 8) return "dev-plan";
  if (n === 9 || n === 19) return "qa-plan";
  if (team === "plan") return "plan";
  if (n >= 24 && n <= 26) return "dev-fix";
  if (n === 27) return "staging";
  if (n >= 28) return "qa-staging";
  if (team === "dev") return "dev";
  return "qa";
};
const phaseMeta = {
  plan: { label: "規劃階段（規格包，Gate 1）", order: 1 },
  "dev-plan": { label: "開發準備（WBS）", order: 2 },
  "qa-plan": { label: "測試準備（測試計畫、案例、追溯）", order: 3 },
  dev: { label: "開發（五批次）", order: 4 },
  qa: { label: "測試（CR / AT / UAT / 總結）", order: 5 },
  "dev-fix": { label: "Code Review 修正", order: 6 },
  staging: { label: "staging 部署", order: 7 },
  "qa-staging": { label: "staging 補驗（Gate 2 r2）", order: 8 },
};

const cards = [];
for (const line of src) {
  const [id, title, team, role, status, round, deps, created, updated, rounds] = line.split("|");
  const segs = [];
  for (const part of (rounds || "").split(";").filter(Boolean)) {
    const [key, times] = part.split("=");
    const [s, e] = (times || "").split("~");
    const m = key.match(/^r(\d+)-(.+)$/);
    if (!m) continue;
    const who = m[2];
    if (s) segs.push({ round: Number(m[1]), who, start: s, end: e || null, review: who !== role });
  }
  cards.push({
    id, title, team, role, status, round: Number(round),
    deps: deps.replace(/[\[\]]/g, "").split(",").map(s => s.trim()).filter(Boolean),
    created: created.replace("+08:00", ""), updated: updated.replace("+08:00", ""),
    phase: phaseOf(id, team), segs,
  });
}
cards.unshift({ id: "T-0000", title: "團隊協作計畫書（Phase 0 框架）", team: "leader", role: "leader", status: "done", round: 1, deps: [], created: "2026-09-19T04:01:00", updated: "2026-09-19T05:12:00", phase: "plan", segs: [{ round: 1, who: "leader", start: "2026-09-19T04:01:00", end: "2026-09-19T05:12:00", review: false }] });

const gates = [
  { t: "2026-09-19T06:57:00", label: "Gate 1 報告" },
  { t: "2026-09-19T14:10:00", label: "Gate 2 報告 r1" },
  { t: "2026-09-19T16:29:00", label: "staging 上線" },
  { t: "2026-09-19T16:46:00", label: "NFR-003 採樣起算" },
];

const data = JSON.stringify({ cards, gates, phaseMeta, generatedAt: new Date().toISOString() });

const html = `<title>E-001 專案時程表</title>
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
.kpi{border:1px solid var(--grid);padding:10px 12px}
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
tr.phase td{color:var(--ink)}
.kpi{color:var(--ink)}
td.mono,th.mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap}
tr.phase td{background:var(--plane);font-weight:700;padding:8px;border-top:1px solid var(--axis)}
.pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:500;white-space:nowrap;color:var(--ink)}
.pill.plan{background:var(--plan-soft)} .pill.dev{background:var(--dev-soft)} .pill.qa{background:var(--qa-soft)} .pill.leader{background:var(--leader-soft)}
.st{font-family:var(--font-mono);font-size:11px;white-space:nowrap}
.st.done{color:var(--good)} .st.in_progress{color:var(--dev)} .st.review{color:var(--plan)} .st.todo{color:var(--muted)} .st.blocked{color:var(--gate)}
.note{font-size:12px;color:var(--ink2);margin-top:10px}
.foot{margin-top:28px;border-top:1px solid var(--axis);padding-top:10px;font-size:11px;color:var(--muted);display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between}

/* Gantt as table: left columns + timeline column */
.gwrap{overflow-x:auto}
table.gantt{min-width:1100px;table-layout:fixed}
table.gantt th,table.gantt td{padding:0 6px;height:26px;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
table.gantt col.c-id{width:64px} table.gantt col.c-name{width:270px} table.gantt col.c-t{width:58px} table.gantt col.c-st{width:64px}
table.gantt tr.phase td{height:28px;font-weight:700;background:var(--plane);border-top:1px solid var(--axis);border-bottom:1px solid var(--grid)}
table.gantt td.name{padding-left:18px}
table.gantt td.tl{padding:0;position:relative;border-left:1px solid var(--axis)}
table.gantt tr.phase td.tl{border-left:1px solid var(--axis)}
.axis{position:relative;height:26px}
.axis .tick{position:absolute;top:0;bottom:0;border-left:1px solid var(--grid)}
.axis .tick span{position:absolute;top:4px;left:3px;font-family:var(--font-mono);font-size:10px;color:var(--muted)}
.tl .grid{position:absolute;top:0;bottom:0;border-left:1px solid var(--grid)}
.tl .grid.half{border-left-style:dotted}
.bar{position:absolute;top:6px;height:14px;border-radius:3px;overflow:hidden;background:var(--plane);border:1px solid var(--ring)}
.bar .fill{position:absolute;left:0;top:0;bottom:0}
.bar .lbl{position:absolute;left:6px;top:0;line-height:12px;font-family:var(--font-mono);font-size:10px;color:var(--ink);white-space:nowrap}
.bar.plan .fill{background:var(--plan)} .bar.dev .fill{background:var(--dev)} .bar.qa .fill{background:var(--qa)} .bar.leader .fill{background:var(--leader)}
.bar.plan{border-color:var(--plan)} .bar.dev{border-color:var(--dev)} .bar.qa{border-color:var(--qa)} .bar.leader{border-color:var(--leader)}
.bar.done .lbl{color:#fff;mix-blend-mode:normal}
.bar.rev{top:8px;height:10px;background:repeating-linear-gradient(135deg,transparent 0 3px,var(--ink2) 3px 4px);border:1px solid var(--ink2)}
.bar.active .fill{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.35) 0 4px,transparent 4px 8px)}
.mark{position:absolute;top:0;bottom:0;border-left:1.5px dashed var(--gate)}
.now{position:absolute;top:0;bottom:0;border-left:2px solid var(--now);z-index:2}
.axis .now span,.axis .mark span{position:absolute;top:-1px;left:4px;font-family:var(--font-mono);font-size:10px;white-space:nowrap}
.axis .now span{color:var(--now);font-weight:500;background:var(--paper);padding:0 3px}
.axis .mark span{color:var(--gate);top:14px}
.milestones{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:11px;color:var(--gate);margin:6px 0 0;font-family:var(--font-mono)}
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
      <h1>E-001 待辦事項 Web 應用 專案時程表</h1>
    </div>
    <div style="display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap">
      <div class="meta">
        <span>日期</span><b>2026-09-19（+08:00）</b>
        <span>Epic 狀態</span><b>gate2 · staging 補驗中</b>
        <span>staging</span><b>todo-app-dpevsdhdva-de.a.run.app</b>
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
    <h2>甘特圖 · 2026-09-19</h2>
    <div class="legend">
      <span><i class="sw" style="background:var(--leader)"></i>Leader</span>
      <span><i class="sw" style="background:var(--plan)"></i>規劃團隊</span>
      <span><i class="sw" style="background:var(--dev)"></i>開發團隊</span>
      <span><i class="sw" style="background:var(--qa)"></i>測試團隊</span>
      <span><i class="sw prog"></i>長條＝實際時段，填滿比例＝進度</span>
      <span><i class="sw rev"></i>審核回合</span>
      <span><i class="sw" style="background:transparent;border-top:2px dashed var(--gate);height:0"></i>關卡／里程碑（編號見圖下）</span>
      <span><i class="sw" style="background:transparent;border-left:2px solid var(--now);width:0;height:12px"></i>現在</span>
    </div>
    <div class="gwrap" style="margin-top:8px"><table class="gantt" id="gantt">
      <colgroup><col class="c-id"><col class="c-name"><col class="c-t"><col class="c-t"><col class="c-st"><col></colgroup>
      <thead><tr><th>卡號</th><th>階段 ／ 任務</th><th class="mono">派工</th><th class="mono">完成</th><th>狀態</th><th style="padding:0"><div class="axis" id="axis"></div></th></tr></thead>
      <tbody></tbody>
    </table></div>
    <div class="milestones" id="ms"></div>
    <p class="note">長條範圍＝執行者實際工作時段（A 段開工 → B 段完工；進行中者到「現在」）；填滿比例＝進度（完成 100%、審核中 90%、進行中依已耗時估 50%、待辦 0%）。斜線細條＝審核者的審核時段。NFR-003 24 小時採樣自 16:46 起算，判讀時間 2026-09-20 16:46 之後，不在本圖範圍。</p>
  </div>

  <div class="foot">
    <span>產出：Leader（Claude Fable 5.1）· 資料來源：tasks/T-*.md frontmatter 與 worklog/handoff/ 各輪 A／B 段</span>
    <span id="gen"></span>
  </div>
</div>
<script>
const DATA = ${data};
const fmt = (iso) => iso ? iso.slice(11,16) : "—";
const mins = (a,b) => (new Date(b) - new Date(a)) / 60000;
const dur = (m) => m < 60 ? Math.round(m) + " 分" : (m/60).toFixed(1) + " 時";
const teamName = { leader:"Leader", plan:"規劃", dev:"開發", qa:"測試" };
const stName = { done:"done", in_progress:"進行中", review:"審核中", todo:"待辦", blocked:"阻塞" };
const startOf = (c) => { const w = c.segs.find(s => !s.review); return w ? w.start : c.created; };
const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");

// theme toggle (default light; remembers per viewer)
const root = document.documentElement, tbtn = document.getElementById("theme");
const applyTheme = (t) => { if (t === "dark") root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme"); tbtn.textContent = t === "dark" ? "淺色模式" : "深色模式"; tbtn.setAttribute("aria-pressed", t === "dark"); };
let theme = "light"; try { theme = localStorage.getItem("schedule-theme") || "light"; } catch (e) {}
applyTheme(theme);
tbtn.addEventListener("click", () => { theme = theme === "dark" ? "light" : "dark"; applyTheme(theme); try { localStorage.setItem("schedule-theme", theme); } catch (e) {} });
document.getElementById("print").addEventListener("click", () => window.print());

// KPIs
const cards = DATA.cards;
const done = cards.filter(c => c.status === "done");
const totalMin = done.reduce((s,c) => s + mins(startOf(c), c.updated), 0);
const kp = [
  ["任務卡", cards.length], ["已完成", done.length], ["進行中／審核中", cards.filter(c => c.status==="in_progress"||c.status==="review").length],
  ["總回合數", cards.reduce((s,c) => s + c.round, 0)], ["達 3 輪上限", cards.filter(c => c.round>=3).length], ["已完成卡歷時合計", dur(totalMin)]
];
document.getElementById("kpis").innerHTML = kp.map(([l,v]) => '<div class="kpi"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>').join("");

// grouping
const byPhase = {};
for (const c of cards) (byPhase[c.phase] ||= []).push(c);
const phases = Object.keys(byPhase).sort((a,b) => DATA.phaseMeta[a].order - DATA.phaseMeta[b].order);

// WBS table
let rows = "";
for (const p of phases) {
  rows += '<tr class="phase"><td colspan="9">'+esc(DATA.phaseMeta[p].label)+'</td></tr>';
  for (const c of byPhase[p].sort((a,b)=>a.id.localeCompare(b.id))) {
    const s = startOf(c), e = c.status === "done" ? c.updated : null;
    rows += '<tr><td class="mono">'+c.id+'</td><td>'+esc(c.title)+'</td><td><span class="pill '+c.team+'">'+teamName[c.team]+'</span> '+c.role+'</td><td class="mono">'+(c.deps.join(", ")||"—")+'</td><td class="mono">'+c.round+'</td><td class="mono">'+fmt(s)+'</td><td class="mono">'+fmt(e)+'</td><td class="mono">'+(e?dur(mins(s,e)):"—")+'</td><td><span class="st '+c.status+'">'+stName[c.status]+'</span></td></tr>';
  }
}
document.querySelector("#wbs tbody").innerHTML = rows;

// Gantt
const now = new Date();
const sameDay = now.toISOString().slice(0,10) === "2026-09-19" || (now.getFullYear()===2026 && now.getMonth()===8 && now.getDate()===19);
const nowLocal = sameDay ? now : null;
const T0 = new Date("2026-09-19T04:00:00");
let endH = 18; if (nowLocal && nowLocal.getHours() + 1 > endH) endH = Math.min(24, nowLocal.getHours() + 1);
const T1 = new Date("2026-09-19T" + String(endH).padStart(2,"0") + ":00:00");
const pct = (d) => Math.max(0, Math.min(100, ((new Date(d) - T0) / (T1 - T0)) * 100));
const nowIso = nowLocal ? new Date(nowLocal.getTime() - nowLocal.getTimezoneOffset()*60000).toISOString().slice(0,19) : null;

let axis = "";
for (let h = 4; h <= endH; h++) {
  const p = pct("2026-09-19T"+String(h).padStart(2,"0")+":00:00");
  axis += '<div class="tick" style="left:'+p+'%"><span>'+String(h).padStart(2,"0")+':00</span></div>';
}
const circled = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨"];
DATA.gates.forEach((g, i) => { axis += '<div class="mark" style="left:'+pct(g.t)+'%"><span title="'+esc(g.label)+'">'+circled[i]+'</span></div>'; });
if (nowIso) axis += '<div class="now" style="left:'+pct(nowIso)+'%"><span>現在 '+fmt(nowIso)+'</span></div>';
document.getElementById("axis").innerHTML = axis;

const gridCells = () => {
  let g = "";
  for (let h = 4; h <= endH; h++) { g += '<div class="grid" style="left:'+pct("2026-09-19T"+String(h).padStart(2,"0")+":00:00")+'%"></div>'; if (h < endH) g += '<div class="grid half" style="left:'+pct("2026-09-19T"+String(h).padStart(2,"0")+":30:00")+'%"></div>'; }
  for (const gt of DATA.gates) g += '<div class="mark" style="left:'+pct(gt.t)+'%"></div>';
  if (nowIso) g += '<div class="now" style="left:'+pct(nowIso)+'%"></div>';
  return g;
};

let grows = "";
for (const p of phases) {
  grows += '<tr class="phase"><td></td><td colspan="4">'+esc(DATA.phaseMeta[p].label)+'</td><td class="tl">'+gridCells()+'</td></tr>';
  for (const c of byPhase[p].sort((a,b)=>a.id.localeCompare(b.id))) {
    const s = startOf(c);
    const e = c.status === "done" ? c.updated : null;
    let bars = gridCells();
    // work bar
    const workSegs = c.segs.filter(x => !x.review && x.start);
    const bStart = workSegs.length ? workSegs[0].start : (c.status === "todo" ? null : c.created);
    let bEnd = null;
    if (c.status === "done") bEnd = c.updated;
    else if (workSegs.length && workSegs[workSegs.length-1].end) bEnd = workSegs[workSegs.length-1].end;
    else if (nowIso) bEnd = nowIso;
    if (bStart && bEnd) {
      const l = pct(bStart), w = Math.max(0.6, pct(bEnd) - l);
      const prog = c.status === "done" ? 100 : c.status === "review" ? 90 : c.status === "in_progress" ? 50 : c.status === "blocked" ? 30 : 0;
      const label = c.status === "done" ? "100%" : c.status === "review" ? "審核中" : c.status === "in_progress" ? "進行中" : stName[c.status];
      bars += '<div class="bar '+c.team+' '+c.status+(c.status==="in_progress"?" active":"")+'" style="left:'+l+'%;width:'+w+'%" title="'+c.id+' '+fmt(bStart)+'–'+fmt(bEnd)+'"><div class="fill" style="width:'+prog+'%"></div><span class="lbl">'+label+'</span></div>';
    }
    // review segments
    for (const r of c.segs.filter(x => x.review && x.start)) {
      const l = pct(r.start), w = Math.max(0.5, pct(r.end || nowIso || r.start) - l);
      bars += '<div class="bar rev" style="left:'+l+'%;width:'+w+'%" title="'+c.id+' r'+r.round+' 審核 '+r.who+' '+fmt(r.start)+'–'+fmt(r.end)+'"></div>';
    }
    grows += '<tr><td class="mono">'+c.id+'</td><td class="name" title="'+esc(c.title)+'">'+esc(c.title)+'</td><td class="mono">'+fmt(s)+'</td><td class="mono">'+fmt(e)+'</td><td><span class="st '+c.status+'">'+stName[c.status]+'</span></td><td class="tl">'+bars+'</td></tr>';
  }
}
document.querySelector("#gantt tbody").innerHTML = grows;
document.getElementById("ms").innerHTML = DATA.gates.map((g, i) => '<span>'+circled[i]+' '+fmt(g.t)+' '+esc(g.label)+'</span>').join("");
document.getElementById("gen").textContent = "資料快照 " + DATA.generatedAt.replace("T"," ").slice(0,16) + " UTC · 「現在」線以開啟頁面時的本機時間計算";
</script>
`;
writeFileSync(out, html, "utf8");
console.log("written", out, html.length, "bytes;", cards.length, "cards");
