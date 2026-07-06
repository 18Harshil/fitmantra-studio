#!/bin/bash
set -e

# ── Parse flags ──────────────────────────────────────────────────────────────
PIPELINE_FLAGS=""
for arg in "$@"; do
  case "$arg" in
    --use-openai) PIPELINE_FLAGS="--use-openai" ;;
  esac
done

echo ""
echo "═══════════════════════════════════════════════════"
echo "  FitMantra Video Pipeline — Full Render"
if [ -n "$PIPELINE_FLAGS" ]; then
  echo "  Mode: 🌐 API (OpenAI + Pexels)"
else
  echo "  Mode: 📦 Offline (cached files)"
fi
echo "═══════════════════════════════════════════════════"

# ── Step 1: Python pipeline ──────────────────────────────────────────────────
echo ""
echo "  [1/2] Running Python pipeline..."
cd pipeline
python3 demo.py $PIPELINE_FLAGS
cd ..

# ── Step 2: Remotion render ───────────────────────────────────────────────────
echo ""
echo "  [2/2] Rendering with Remotion..."
cd remotion

# 16:9 YouTube
npx remotion render MainVideo \
  --output ../pipeline/output/final_16x9.mp4

# 9:16 Instagram Reels
npx remotion render MainVideo \
  --output ../pipeline/output/final_9x16.mp4 \
  --width 1080 \
  --height 1920

cd ..

echo ""
echo "═══════════════════════════════════════════════════"
echo "  RENDER COMPLETE"
echo ""
echo "  16:9 YouTube : pipeline/output/final_16x9.mp4"
echo "  9:16 Reels   : pipeline/output/final_9x16.mp4"
echo "═══════════════════════════════════════════════════"
echo ""

