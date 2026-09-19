import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(process.argv[3] || (process.env.TEMP + "/cards.txt"), "utf8").trim().split(/\r?\n/);
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
const teamOf = (role) => role === "leader" ? "leader" : role.split("-")[0];

const cards = [];
for (const line of src) {
  const [id, title, team, role, status, round, deps, created, updated, rounds] = line.split("|");
  const segs = [];
  for (const part of (rounds || "").split(";").filter(Boolean)) {
    const [key, times] = part.split("=");
    const [s, e] = times.split("~");
    const m = key.match(/^r(\d+)-(.+)$/);
    if (!m) continue;
    const who = m[2];
    const isReview = who !== role;
    if (s) segs.push({ round: Number(m[1]), who, start: s, end: e || null, review: isReview });
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
  --paper:#fcfcfb; --plane:#f5f5f2; --ink:#0b0b0b; --ink2:#52514e; --muted:#898781; --grid:#e1e0d9; --axis:#c3c2b7; --ring:rgba(11,11,11,.10);
  --plan:#2a78d6; --dev:#eb6834; --qa:#1baf7a; --leader:#4a3aa7; --gate:#d03b3b; --now:#0b0b0b;
  --plan-soft:#dbe8f9; --dev-soft:#fbe3d9; --qa-soft:#d6f1e6; --leader-soft:#e2dff5;
  --font-body:"Noto Sans TC",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --paper:#1a1a19; --plane:#0d0d0d; --ink:#ffffff; --ink2:#c3c2b7; --muted:#898781; --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,.10);
  --plan:#3987e5; --dev:#d95926; --qa:#199e70; --leader:#9085e9; --gate:#e66767; --now:#ffffff;
  --plan-soft:#1c3558; --dev-soft:#4a2416; --qa-soft:#153d2e; --leader-soft:#2c2757;
}}
:root[data-theme="dark"]{
  --paper:#1a1a19; --plane:#0d0d0d; --ink:#ffffff; --ink2:#c3c2b7; --muted:#898781; --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,.10);
  --plan:#3987e5; --dev:#d95926; --qa:#199e70; --leader:#9085e9; --gate:#e66767; --now:#ffffff;
  --plan-soft:#1c3558; --dev-soft:#4a2416; --qa-soft:#153d2e; --leader-soft:#2c2757;
}
*{box-sizing:border-box}
body{background:var(--plane);color:var(--ink);font-family:var(--font-body);font-size:13px;line-height:1.5;margin:0;padding-block:24px;padding-inline:20px}
.sheet{max-width:1320px;margin:0 auto;background:var(--paper);border:1px solid var(--ring);padding:28px 32px}
h1{font-size:22px;margin:0;letter-spacing:.01em;text-wrap:balance}
h2{font-size:15px;margin:32px 0 10px;letter-spacing:.02em;text-transform:uppercase;color:var(--ink2)}
.head{display:flex;flex-wrap:wrap;gap:16px 32px;align-items:flex-end;justify-content:space-between;border-bottom:2px solid var(--ink);padding-bottom:12px}
.meta{font-family:var(--font-mono);font-size:12px;color:var(--ink2);display:grid;grid-template-columns:auto auto;gap:2px 14px}
.meta b{color:var(--ink);font-weight:500}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:16px}
.kpi{border:1px solid var(--grid);padding:10px 12px}
.kpi .v{font-family:var(--font-mono);font-size:22px;font-weight:500;font-variant-numeric:tabular-nums}
.kpi .l{font-size:11px;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
.legend{display:flex;flex-wrap:wrap;gap:10px 18px;font-size:12px;color:var(--ink2);margin:8px 0 0}
.legend span{display:inline-flex;align-items:center;gap:6px}
.sw{width:22px;height:10px;border-radius:2px;display:inline-block}
.sw.rev{background:repeating-linear-gradient(135deg,transparent 0 3px,var(--ink2) 3px 4px);border:1px solid var(--ink2)}
.tablewrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:12px}
th{text-align:left;font-weight:500;color:var(--ink2);border-bottom:1px solid var(--axis);padding:6px 8px;white-space:nowrap;letter-spacing:.02em}
td{border-bottom:1px solid var(--grid);padding:5px 8px;vertical-align:top}
td.mono,th.mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap}
tr.phase td{background:var(--plane);font-weight:700;padding:8px;border-top:1px solid var(--axis)}
.pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:500;border:1px solid transparent;white-space:nowrap}
.pill.plan{background:var(--plan-soft);color:var(--ink)} .pill.dev{background:var(--dev-soft);color:var(--ink)} .pill.qa{background:var(--qa-soft);color:var(--ink)} .pill.leader{background:var(--leader-soft);color:var(--ink)}
.st{font-family:var(--font-mono);font-size:11px}
.st.done{color:#006300} .st.in_progress{color:var(--dev)} .st.review{color:var(--plan)} .st.todo{color:var(--muted)} .st.blocked{color:var(--gate)}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .st.done{color:#0ca30c} }
:root[data-theme="dark"] .st.done{color:#0ca30c}
.gantt{overflow-x:auto}
svg text{font-family:var(--font-body);fill:var(--ink)}
svg .mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.note{font-size:12px;color:var(--ink2);margin-top:10px}
.foot{margin-top:28px;border-top:1px solid var(--axis);padding-top:10px;font-size:11px;color:var(--muted);display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between}
@page{size:A4 landscape;margin:12mm}
@media print{
  body{background:#fff;padding:0;font-size:11px}
  .sheet{border:0;padding:0;max-width:none}
  h2{margin-top:16px}
  .gantt-section{break-before:page}
  table{font-size:10px} th,td{padding:3px 6px}
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
    <div class="meta">
      <span>日期</span><b>2026-09-19（+08:00）</b>
      <span>Epic 狀態</span><b>gate2 · staging 補驗中</b>
      <span>main</span><b>8fa33f1</b>
      <span>staging</span><b>todo-app-dpevsdhdva-de.a.run.app</b>
    </div>
  </div>
  <div class="kpis" id="kpis"></div>
  <div class="legend">
    <span><i class="sw" style="background:var(--leader)"></i>Leader</span>
    <span><i class="sw" style="background:var(--plan)"></i>規劃團隊</span>
    <span><i class="sw" style="background:var(--dev)"></i>開發團隊</span>
    <span><i class="sw" style="background:var(--qa)"></i>測試團隊</span>
    <span><i class="sw rev"></i>審核回合（dev-tl／plan／qa-lead／Leader）</span>
    <span><i class="sw" style="background:transparent;border-top:2px dashed var(--gate);height:0"></i>關卡／里程碑</span>
  </div>

  <h2>WBS 工作分解表</h2>
  <div class="tablewrap"><table id="wbs">
    <thead><tr><th>卡號</th><th>標題</th><th>團隊／角色</th><th>依賴</th><th>回合</th><th class="mono">派工</th><th class="mono">完成</th><th class="mono">歷時</th><th>狀態</th></tr></thead>
    <tbody></tbody>
  </table></div>
  <p class="note">派工時間取該卡第 1 輪交接檔 A 段的開工時間（無交接檔者取任務卡建立時間）；完成時間取判 done 時任務卡的 updated；歷時為兩者之差（含等待審核）。逐輪細節見 <code>worklog/handoff/</code>。</p>

  <div class="gantt-section">
    <h2>甘特圖 · 2026-09-19 04:00 – 18:00</h2>
    <div class="gantt" id="gantt"></div>
    <p class="note">實心段 = 該卡執行者的工作時段（A 段開工 → B 段完工）；斜線段 = 審核者的審核時段；同一卡多段代表多輪。虛線為關卡與里程碑。NFR-003 24 小時採樣自 16:46 起算，判讀時間為 2026-09-20 16:46 之後，不在本圖範圍。</p>
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
const teamCls = (t) => t;
const teamName = { leader:"Leader", plan:"規劃", dev:"開發", qa:"測試" };
const stName = { done:"done", in_progress:"進行中", review:"審核中", todo:"待辦", blocked:"阻塞" };
const startOf = (c) => { const w = c.segs.find(s => !s.review); return w ? w.start : c.created; };

// KPIs
const cards = DATA.cards;
const done = cards.filter(c => c.status === "done");
const totalMin = done.reduce((s,c) => s + mins(startOf(c), c.updated), 0);
const rounds = cards.reduce((s,c) => s + c.round, 0);
const kp = [
  ["任務卡", cards.length], ["已完成", done.length], ["進行中／審核中", cards.filter(c => c.status==="in_progress"||c.status==="review").length],
  ["總回合數", rounds], ["達 3 輪上限", cards.filter(c => c.round>=3).length], ["已完成卡歷時合計", dur(totalMin)]
];
document.getElementById("kpis").innerHTML = kp.map(([l,v]) => '<div class="kpi"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>').join("");

// WBS table
const byPhase = {};
for (const c of cards) (byPhase[c.phase] ||= []).push(c);
const phases = Object.keys(byPhase).sort((a,b) => DATA.phaseMeta[a].order - DATA.phaseMeta[b].order);
let rows = "";
for (const p of phases) {
  rows += '<tr class="phase"><td colspan="9">'+DATA.phaseMeta[p].label+'</td></tr>';
  for (const c of byPhase[p].sort((a,b)=>a.id.localeCompare(b.id))) {
    const s = startOf(c), e = c.status === "done" ? c.updated : null;
    rows += '<tr><td class="mono">'+c.id+'</td><td>'+c.title+'</td><td><span class="pill '+teamCls(c.team)+'">'+teamName[c.team]+'</span> '+c.role+'</td><td class="mono">'+(c.deps.join(", ")||"—")+'</td><td class="mono">'+c.round+'</td><td class="mono">'+fmt(s)+'</td><td class="mono">'+fmt(e)+'</td><td class="mono">'+(e?dur(mins(s,e)):"—")+'</td><td><span class="st '+c.status+'">'+stName[c.status]+'</span></td></tr>';
  }
}
document.querySelector("#wbs tbody").innerHTML = rows;

// Gantt
const T0 = new Date("2026-09-19T04:00:00"), T1 = new Date("2026-09-19T18:00:00");
const W = 1240, LEFT = 300, RIGHT = 20, ROW = 22, TOP = 34;
const ordered = phases.flatMap(p => [{phase:p}, ...byPhase[p].sort((a,b)=>a.id.localeCompare(b.id))]);
const H = TOP + ordered.length * ROW + 30;
const x = (iso) => LEFT + ((new Date(iso) - T0) / (T1 - T0)) * (W - LEFT - RIGHT);
const colorOf = (t) => "var(--"+t+")";
let svg = '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="min-width:900px;display:block" role="img" aria-label="E-001 甘特圖">';
// hour grid
for (let h = 4; h <= 18; h++) {
  const xx = x("2026-09-19T"+String(h).padStart(2,"0")+":00:00");
  svg += '<line x1="'+xx+'" y1="'+(TOP-8)+'" x2="'+xx+'" y2="'+(H-24)+'" stroke="var(--grid)" stroke-width="1"/>';
  svg += '<text class="mono" x="'+xx+'" y="'+(TOP-14)+'" font-size="10" text-anchor="middle" fill="var(--muted)">'+String(h).padStart(2,"0")+':00</text>';
  if (h < 18) { const xm = x("2026-09-19T"+String(h).padStart(2,"0")+":30:00"); svg += '<line x1="'+xm+'" y1="'+(TOP-4)+'" x2="'+xm+'" y2="'+(H-24)+'" stroke="var(--grid)" stroke-width="1" stroke-dasharray="1 4"/>'; }
}
svg += '<line x1="'+LEFT+'" y1="'+(TOP-8)+'" x2="'+LEFT+'" y2="'+(H-24)+'" stroke="var(--axis)"/>';
svg += '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink2)" stroke-width="1.5"/></pattern></defs>';
let yy = TOP;
for (const item of ordered) {
  if (item.phase) {
    svg += '<rect x="0" y="'+yy+'" width="'+W+'" height="'+ROW+'" fill="var(--plane)"/>';
    svg += '<text x="8" y="'+(yy+15)+'" font-size="11" font-weight="700" fill="var(--ink2)">'+DATA.phaseMeta[item.phase].label+'</text>';
    yy += ROW; continue;
  }
  const c = item;
  svg += '<line x1="0" y1="'+(yy+ROW)+'" x2="'+W+'" y2="'+(yy+ROW)+'" stroke="var(--grid)"/>';
  svg += '<text class="mono" x="8" y="'+(yy+15)+'" font-size="10.5">'+c.id+'</text>';
  const label = c.title.length > 26 ? c.title.slice(0,25)+"…" : c.title;
  svg += '<text x="64" y="'+(yy+15)+'" font-size="10.5">'+label+'</text>';
  svg += '<text class="mono" x="'+(LEFT-6)+'" y="'+(yy+15)+'" font-size="9.5" text-anchor="end" fill="var(--muted)">'+c.role+'</text>';
  const col = colorOf(c.team);
  const segs = c.segs.filter(s => s.start);
  if (!segs.length && c.status !== "todo") {
    const s = c.created, e = c.status === "done" ? c.updated : null;
    if (e) segs.push({start:s, end:e, review:false});
  }
  for (const s of segs) {
    const x1 = x(s.start), x2 = s.end ? x(s.end) : x(new Date(Math.min(Date.now(), T1)).toISOString().slice(0,19));
    const w = Math.max(3, x2 - x1);
    svg += '<rect x="'+x1+'" y="'+(yy+5)+'" width="'+w+'" height="12" rx="3" fill="'+(s.review ? "url(#hatch)" : col)+'" '+(s.review?'stroke="var(--ink2)" stroke-width="1"':'')+'><title>'+c.id+' r'+(s.round||"")+' '+(s.who||c.role)+' '+fmt(s.start)+'–'+fmt(s.end)+'</title></rect>';
  }
  if (c.status === "done") {
    const xe = x(c.updated);
    svg += '<polygon points="'+xe+','+(yy+3)+' '+(xe+4)+','+(yy+11)+' '+xe+','+(yy+19)+' '+(xe-4)+','+(yy+11)+'" fill="var(--ink)"><title>'+c.id+' done '+fmt(c.updated)+'</title></polygon>';
  } else if (c.status === "todo") {
    svg += '<text x="'+(x("2026-09-19T17:20:00"))+'" y="'+(yy+15)+'" font-size="10" fill="var(--muted)">待辦（依賴未完成）</text>';
  }
  yy += ROW;
}
for (const g of DATA.gates) {
  const gx = x(g.t);
  svg += '<line x1="'+gx+'" y1="'+(TOP-8)+'" x2="'+gx+'" y2="'+(H-24)+'" stroke="var(--gate)" stroke-width="1.5" stroke-dasharray="4 3"/>';
  svg += '<text class="mono" x="'+(gx+3)+'" y="'+(H-10)+'" font-size="9.5" fill="var(--gate)">'+g.label+' '+fmt(g.t)+'</text>';
}
svg += '</svg>';
document.getElementById("gantt").innerHTML = svg;
document.getElementById("gen").textContent = "產生時間 " + DATA.generatedAt.replace("T"," ").slice(0,16) + " UTC";
</script>
`;
writeFileSync(out, html, "utf8");
console.log("written", out, html.length, "bytes;", cards.length, "cards");
