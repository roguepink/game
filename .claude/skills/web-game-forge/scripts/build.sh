#!/bin/bash
# usage: build.sh <out> [test|artifact]
D=$(dirname "$0")/parts
OUT=${1:-$(dirname "$0")/out.html}
MAIN=80_main.js
[ "$2" = "test" ] && MAIN=80_main_test.js
TMP=$(mktemp)
{
  cat $D/00_head.html
  for f in 10_util.js track_def.js 20_track.js 30_render.js 35_scenery.js 40_bike.js 50_fx.js 60_sim.js 70_ui.js $MAIN; do
    [ -f $D/$f ] && { echo "// ---------- $f ----------"; cat $D/$f; echo; }
  done
  cat $D/99_tail.html
} > "$TMP"
if [ "$2" = "artifact" ]; then
  python3 - "$TMP" "$OUT" <<'PY'
import re,sys
s=open(sys.argv[1]).read()
s=re.sub(r'<!--SA-->.*?<!--/SA-->\n?','',s,flags=re.S)
open(sys.argv[2],'w').write(s)
PY
else
  python3 - "$TMP" "$OUT" <<'PY'
import re,sys
s=open(sys.argv[1]).read()
s=re.sub(r'<!--/?SA-->\n?','',s)
open(sys.argv[2],'w').write(s)
PY
fi
rm -f "$TMP"
wc -c "$OUT"
