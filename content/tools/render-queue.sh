#!/bin/bash
# طابور إنتاج فيديوهات الدروس: يصيّر كل درس له تعليق وتوقيتات ولم يُنتج فيديوه بعد.
#   ./render-queue.sh   (يمكن تشغيل عاملَين معاً؛ كل درس يُحجز بقفل حتى لا يتكرر)
cd "$(dirname "$0")"
LOCKS=/tmp/lesson-render-locks; mkdir -p $LOCKS
while true; do
  next=""
  for w in ../skill-*/raw/lesson-*-words.json; do
    [ -e "$w" ] || continue
    sid=$(basename $(dirname $(dirname $w))); name=$(basename $w -words.json)
    out=../../web/public/media/$sid/$name-video.mp4
    [ -f "$out" ] && [ "$out" -nt "$w" ] && continue
    mkdir $LOCKS/$sid-$name 2>/dev/null || continue
    next="$sid $name"; break
  done
  [ -z "$next" ] && exit 0
  set -- $next
  node render-video.mjs ../$1 $2 2>&1 | grep -v "إطار" | tail -1
  rmdir $LOCKS/$1-$2
done
