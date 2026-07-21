#!/usr/bin/env bash
# Rebuild public/cursors/*.png — HUD reticle + locked (select) variant.
# Requires ImageMagick (magick on PATH).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/cursors"
MAGICK="${MAGICK:-$(command -v magick)}"
mkdir -p "$OUT"

CYAN='#7ffbff'
RED='#ff3b53'
DIM='rgba(127,251,255,0.55)'

# Aim: corner brackets + gapped cross + red pip. Hotspot center (15,15).
"$MAGICK" -size 32x32 xc:none -filter Point \
  -fill "$DIM" \
  -draw 'rectangle 2,2 9,3' \
  -draw 'rectangle 2,2 3,9' \
  -draw 'rectangle 22,2 29,3' \
  -draw 'rectangle 28,2 29,9' \
  -draw 'rectangle 2,28 9,29' \
  -draw 'rectangle 2,22 3,29' \
  -draw 'rectangle 22,28 29,29' \
  -draw 'rectangle 28,22 29,29' \
  -fill "$CYAN" \
  -draw 'rectangle 15,3 16,11' \
  -draw 'rectangle 15,20 16,28' \
  -draw 'rectangle 3,15 11,16' \
  -draw 'rectangle 20,15 28,16' \
  -fill "$RED" \
  -draw 'rectangle 14,14 17,17' \
  -depth 8 -strip "PNG32:$OUT/aim.png"

# Select: same reticle, brighter brackets + solid cyan lock pip (no arrow).
"$MAGICK" -size 32x32 xc:none -filter Point \
  -fill "$CYAN" \
  -draw 'rectangle 2,2 10,3' \
  -draw 'rectangle 2,2 3,10' \
  -draw 'rectangle 21,2 29,3' \
  -draw 'rectangle 28,2 29,10' \
  -draw 'rectangle 2,28 10,29' \
  -draw 'rectangle 2,21 3,29' \
  -draw 'rectangle 21,28 29,29' \
  -draw 'rectangle 28,21 29,29' \
  -draw 'rectangle 15,3 16,12' \
  -draw 'rectangle 15,19 16,28' \
  -draw 'rectangle 3,15 12,16' \
  -draw 'rectangle 19,15 28,16' \
  -fill "$RED" \
  -draw 'rectangle 13,13 18,18' \
  -fill "$CYAN" \
  -draw 'rectangle 14,14 17,17' \
  -depth 8 -strip "PNG32:$OUT/select.png"

echo "wrote $OUT/aim.png  $OUT/select.png"
identify "$OUT/aim.png" "$OUT/select.png"
