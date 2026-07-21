#!/usr/bin/env bash
# Rebuild public/og.png — nebula + title logo only (no cast, no veil plate).
# Requires ImageMagick (magick on PATH).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
MAGICK="${MAGICK:-$(command -v magick)}"

"$MAGICK" "$ROOT/public/branding/mecha-redline-logo.png" \
  -fuzz 16% -transparent 'rgb(255,0,255)' -trim +repage "$TMP/logo.png"

"$MAGICK" "$ROOT/public/branding/nebula.png" -modulate 100,95,100 "$TMP/scene.png"

# Soft vignette so the mark pops without a plate
"$MAGICK" -size 1200x630 radial-gradient:'rgba(8,12,24,0)'-'rgba(8,12,24,0.45)' "$TMP/vig.png"
"$MAGICK" "$TMP/scene.png" "$TMP/vig.png" -compose multiply -composite "$TMP/scene2.png"

"$MAGICK" "$TMP/logo.png" -resize 720x "$TMP/logo-r.png"

"$MAGICK" "$TMP/scene2.png" \
  \( "$TMP/logo-r.png" -gravity center -geometry +0-16 \) -compose over -composite \
  -fill 'rgba(255,59,83,0.95)' -draw 'rectangle 400,548 800,550' \
  -fill '#b8ffff' -font Helvetica-Bold -pointsize 17 \
  -gravity south -annotate +0+48 'MISSION 01 ── SECTOR 7' \
  -depth 8 -strip \
  "$ROOT/public/og.png"

echo "wrote $ROOT/public/og.png"
identify "$ROOT/public/og.png"
