#!/usr/bin/env bash
# 抽取任務卡 frontmatter 與各輪交接檔的開工／完工時戳，輸出管線分隔文字供 gen-schedule.mjs 使用。
# 用法：bash scripts/extract-cards.sh [輸出檔]   （預設 docs/schedule/cards.txt）
# 格式：id|title|team|role|status|phase|round|depends_on|created|updated|epic|r{n}-{role}=start~end;...
# phase 取自任務卡 frontmatter 的 phase 欄；卡上沒有就留空，由 gen-schedule.mjs 回退 phaseById／phaseByTeam。
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-docs/schedule/cards.txt}"
mkdir -p "$(dirname "$OUT")"
: > "$OUT"
for f in tasks/T-*.md; do
  id=$(grep -m1 '^id:' "$f" | sed 's/id: *//')
  title=$(grep -m1 '^title:' "$f" | sed 's/title: *//')
  team=$(grep -m1 '^team:' "$f" | sed 's/team: *//')
  role=$(grep -m1 '^role:' "$f" | sed 's/role: *//')
  status=$(grep -m1 '^status:' "$f" | sed 's/status: *//')
  phase=$(grep -m1 '^phase:' "$f" | sed 's/phase: *//' || true)
  round=$(grep -m1 '^round:' "$f" | sed 's/round: *//')
  deps=$(grep -m1 '^depends_on:' "$f" | sed 's/depends_on: *//')
  created=$(grep -m1 '^created:' "$f" | sed 's/created: *//')
  updated=$(grep -m1 '^updated:' "$f" | sed 's/updated: *//')
  epic=$(grep -m1 '^epic:' "$f" | sed 's/epic: *//' || true)
  num=${id#T-}
  segs=""
  for h in $(ls worklog/handoff/*-T${num}-r*-*.md 2>/dev/null); do
    r=$(basename "$h" | grep -oE 'r[0-9]+-[a-z-]+' | head -1)
    s=$(grep -m1 '開工時間：' "$h" | sed -E 's/.*開工時間：//; s/\+08:00//; s/[（(].*//' | xargs || true)
    e=$(grep -m1 '完工時間／狀態：' "$h" | sed -E 's/.*完工時間／狀態：//; s/\+08:00//; s# */.*##' | xargs || true)
    segs="${segs}${r}=${s}~${e};"
  done
  echo "$id|$title|$team|$role|$status|$phase|$round|$deps|$created|$updated|$epic|$segs" >> "$OUT"
done
echo "extracted $(wc -l < "$OUT") cards -> $OUT"
