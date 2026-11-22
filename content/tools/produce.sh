#!/usr/bin/env bash
# يُنتج وسائط مهارة: ./produce.sh skill-02
# يتطلب: raw/narration.mp3 و raw/words.json داخل مجلد المهارة.
set -euo pipefail
cd "$(dirname "$0")"
S="$1"; D="../$S"; R="$D/raw"
[ -f "$R/narration.mp3" ] && [ -f "$R/words.json" ] || { echo "ينقص التعليق أو توقيت الكلمات في $R"; exit 1; }
# الموسيقى ومؤثر الانتقال مشتركان بين المهارات
for f in music.wav whoosh.mp3; do [ -f "$R/$f" ] || cp ../skill-01/raw/$f "$R/$f"; done
# صورة الافتتاحية = غلاف المهارة
[ -f "$R/cover.jpg" ] || cp "../images/covers/$S.jpg" "$R/cover.jpg"
node render-infographic.mjs "$D"
node render-video.mjs "$D"
