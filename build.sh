#!/bin/bash
# index.html は src/ の部品をつなげて作る。 使い方: ./build.sh   (index.html を作り直す)
D=$(dirname "$0")/src
OUT=${1:-$(dirname "$0")/index.html}
{
  cat $D/00_head.html
  for f in $(ls $D | grep -E '^[0-9]{2}_.*\.js$' | sort); do
    echo "// ---------- $f ----------"; cat $D/$f; echo
  done
  cat $D/99_tail.html
} > "$OUT"
