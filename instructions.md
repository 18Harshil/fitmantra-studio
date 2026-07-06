# FitMantra Video Pipeline — Agentic Build Instructions

> **Purpose:** This document is a complete specification for an agentic AI IDE (Google antigravity, Cursor, Windsurf, Claude Code, etc.) to build the FitMantra automated video editing pipeline from scratch. Follow every section in order. Do not skip steps. Do not infer missing details — every decision is specified explicitly.

---

## Project Overview

Build a two-stage local video production pipeline that takes a raw talking-head MP4 video and outputs a polished, subtitle-animated, b-roll-enhanced video in both 16:9 (YouTube) and 9:16 (Instagram Reels) formats.

**Stage 1 — Python Pipeline:** Transcription, AI analysis, scene planning, visual fetching. Outputs `remotion_data.json`.

**Stage 2 — Remotion Renderer:** Reads `remotion_data.json`, renders animated subtitles, b-roll overlays, stat cards, branded intro/outro into a final composed MP4.

**The pipeline runs entirely on the developer's local machine. No cloud services in Stage 1.**

---

## Absolute Rules for This Codebase

1. Every function has a type-annotated signature and a docstring
2. Every subprocess call uses `capture_output=True` and checks `returncode` explicitly — never use `check=True` alone
3. All API keys come from `.env` via `python-dotenv` — zero hardcoded values anywhere
4. All file paths use `pathlib.Path` — never string concatenation for paths
5. Every error is caught specifically — never bare `except:` clauses
6. All Remotion components are functional — no class components
7. All Remotion styling uses inline style objects — no external CSS files
8. The `remotion_data.json` contract is the single source of truth between Python and Remotion — never pass data any other way
9. FFmpeg binary path is always `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`
10. FFprobe binary path is always `/opt/homebrew/opt/ffmpeg-full/bin/ffprobe`

---

## Tech Stack — Exact Versions

### Python Pipeline
```
Python          3.11+
openai          latest (pip install openai)
requests        latest
python-dotenv   latest
pathlib         stdlib
subprocess      stdlib
json            stdlib
shutil          stdlib
re              stdlib
```

### Remotion Renderer
```
Node.js         18+
remotion        4.0.x       (npx create-video@latest)
@remotion/player latest
react           18.x
typescript      5.x
```

### System Dependencies
```
ffmpeg-full     installed via: brew install ffmpeg-full
                binary at: /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg
                MUST have: ass filter, drawtext filter, subtitles filter
                verify with: /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg -filters 2>/dev/null | grep -E "ass|drawtext|subtitles"
```

---

## Project Directory Structure

Create exactly this structure. Do not deviate.

```
fitmantra-video-pipeline/
│
├── pipeline/
│   ├── demo.py                    ← main orchestrator script
│   ├── steps/
│   │   ├── __init__.py            ← empty file
│   │   ├── extract_audio.py
│   │   ├── transcribe.py
│   │   ├── analyse.py
│   │   ├── fetch_visuals.py
│   │   └── prepare_remotion.py
│   ├── input/
│   │   └── .gitkeep
│   ├── output/
│   │   └── .gitkeep
│   ├── .env                       ← never committed
│   ├── .env.example               ← always committed
│   ├── requirements.txt
│   └── venv/                      ← never committed
│
├── remotion/
│   ├── src/
│   │   ├── Root.tsx
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── compositions/
│   │       ├── MainVideo.tsx
│   │       ├── Subtitles.tsx
│   │       ├── BRoll.tsx
│   │       ├── StatCard.tsx
│   │       └── Intro.tsx
│   ├── public/
│   │   ├── visuals/               ← Python copies files here
│   │   │   └── .gitkeep
│   │   └── remotion_data.json     ← Python writes this
│   ├── package.json
│   ├── tsconfig.json
│   └── remotion.config.ts
│
├── render.sh                      ← one-command runner
├── .gitignore
└── README.md
```

---

## `.gitignore` — Root Level

```gitignore
# Python
pipeline/venv/
pipeline/__pycache__/
pipeline/**/__pycache__/
pipeline/**/*.pyc
pipeline/.env
pipeline/input/*.mp4
pipeline/input/*.mov
pipeline/input/*.avi
pipeline/output/

# Remotion
remotion/node_modules/
remotion/public/visuals/*.jpg
remotion/public/visuals/*.png
remotion/public/visuals/*.mp4
remotion/public/remotion_data.json

# System
.DS_Store
*.log
```

---

## `.env.example` — Committed to Git

```env
OPENAI_API_KEY=
PEXELS_API_KEY=
PIXABAY_API_KEY=
```

---

## Environment Variables — Description

| Variable | Where to Get | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | platform.openai.com | Whisper transcription + GPT-4o analysis + DALL-E image generation |
| `PEXELS_API_KEY` | pexels.com/api | Free royalty-free stock images and video clips |
| `PIXABAY_API_KEY` | pixabay.com/api | Free background music tracks |

---

## Python Pipeline — Complete Specification

### `pipeline/requirements.txt`

```
openai
requests
python-dotenv
```

---

### `pipeline/steps/__init__.py`

Empty file. Just create it.

---

### `pipeline/steps/extract_audio.py`

**Purpose:** Extract audio track from input video as MP3 using ffmpeg-full.

**Function signature:**
```python
def extract_audio(video_path: Path, output_dir: Path) -> Path:
```

**Implementation requirements:**
- Use `FFMPEG = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"` as constant at top of file
- Run ffmpeg with: `-i {video_path} -q:a 0 -map a {output_path} -y -loglevel error`
- Output file: `output_dir / "audio.mp3"`
- Use `subprocess.run` with `capture_output=True`
- If `returncode != 0`, raise `RuntimeError(f"FFmpeg audio extraction failed: {result.stderr.decode()}")`
- Print: `"    ✔ Audio extracted → {output_path}"`
- Return the audio path as `Path`

---

### `pipeline/steps/transcribe.py`

**Purpose:** Send audio to OpenAI Whisper API, get word-level timestamped transcript.

**Function signature:**
```python
def transcribe(audio_path: Path, output_dir: Path, client: OpenAI) -> dict:
```

**Implementation requirements:**
- Call `client.audio.transcriptions.create` with:
  - `model="whisper-1"`
  - `response_format="verbose_json"`
  - `timestamp_granularities=["word"]`
- Build words list: `[{"word": w.word, "start": w.start, "end": w.end} for w in response.words]`
- Build full_text: join all words with space
- Save to `output_dir / "transcript.json"` as JSON with `indent=2`
- Print: `"    ✔ Transcribed {len(words)} words"`
- Print: `"    Preview: {full_text[:120]}..."`
- Return: `{"words": words, "full_text": full_text}`

---

### `pipeline/steps/analyse.py`

**Purpose:** Send transcript to GPT-4o. Get back scene plan, cuts, stat overlays, caption, hashtags.

**Function signature:**
```python
def analyse(transcript: dict, output_dir: Path, client: OpenAI) -> dict:
```

**The GPT-4o prompt — use exactly this:**

```
You are a professional video director and editor for health and nutrition content.

Analyse this transcript and return ONLY valid JSON with this exact structure — no other text:

{
  "scenes": [
    {
      "start": float,
      "end": float,
      "tone": "educational|inspirational|cautionary|conversational",
      "visual_type": "talking_head|broll_image|broll_video|text_card",
      "visual_concept": "specific descriptive search term for Pexels",
      "transition_in": "fade|slide_left|slide_right|zoom_in",
      "transition_out": "fade|slide_left|slide_right|zoom_out",
      "narration_summary": "one sentence summary of what speaker says here"
    }
  ],
  "suggested_cuts": [
    {
      "start": float,
      "end": float,
      "reason": "string",
      "confidence": float
    }
  ],
  "stat_overlays": [
    {
      "timestamp": float,
      "text": "statistic or key claim from transcript",
      "duration": 3
    }
  ],
  "suggested_caption": "Instagram caption with emojis, under 150 words",
  "hashtags": "#nutrition #dietitian #healthyeating",
  "suggested_title": "YouTube video title",
  "overall_mood": "calm|energetic|serious|inspirational"
}

Scene planning rules:
- Divide the transcript into 3-8 meaningful narrative scenes
- visual_type "talking_head" means keep original footage visible
- visual_type "broll_image" means overlay a relevant still image
- visual_type "broll_video" means overlay a relevant video clip
- visual_type "text_card" means show a full-screen text graphic
- visual_concept must be specific and searchable: "woman preparing healthy salad bowl" not "food"
- Identify 2-5 filler/silence cuts in suggested_cuts
- Extract any statistics, numbers, or key claims for stat_overlays
- overall_mood determines background music selection

Transcript:
{full_text}

Word timestamps (first 120 words for reference):
{json.dumps(words[:120], indent=2)}
```

**Implementation requirements:**
- Use `response_format={"type": "json_object"}`
- Model: `"gpt-4o"`
- Calculate and print cost: `(prompt_tokens * 0.000005) + (completion_tokens * 0.000015)`
- Save result to `output_dir / "analysis.json"` with `indent=2`
- Print: `"    ✔ Analysis complete (cost: ${cost:.4f})"`
- Print: `"    Found: {len(scenes)} scenes, {len(cuts)} cuts, {len(stats)} stat overlays"`
- Return the parsed JSON dict

---

### `pipeline/steps/fetch_visuals.py`

**Purpose:** For each scene requiring a visual, fetch from Pexels (video first, then image). Fall back to DALL-E 3 if Pexels returns nothing relevant.

**Function signatures:**
```python
def fetch_visuals(scenes: list, output_dir: Path,
                  pexels_key: str, client: OpenAI) -> list:

def _fetch_pexels_video(concept: str, pexels_key: str,
                         output_dir: Path, index: int) -> str | None:

def _fetch_pexels_image(concept: str, pexels_key: str,
                         output_dir: Path, index: int) -> str | None:

def _generate_dalle_image(concept: str, output_dir: Path,
                           client: OpenAI, index: int) -> str | None:
```

**Pexels video endpoint:**
```
GET https://api.pexels.com/videos/search
Headers: Authorization: {pexels_key}
Params: query={concept}, per_page=3, orientation=landscape, size=medium
Extract: response["videos"][0]["video_files"] → find file where quality=="hd" or take first
Download the video file to output_dir / f"broll_video_{index}.mp4"
```

**Pexels image endpoint:**
```
GET https://api.pexels.com/v1/search
Headers: Authorization: {pexels_key}
Params: query={concept}, per_page=1, orientation=landscape
Extract: response["photos"][0]["src"]["large2x"]
Download to output_dir / f"broll_image_{index}.jpg"
```

**DALL-E generation:**
```python
response = client.images.generate(
    model="dall-e-3",
    prompt=f"{concept}, photorealistic, professional health and nutrition content, "
           f"clean composition, warm natural lighting, no text overlays",
    size="1792x1024",
    quality="standard",
    n=1
)
# Download from response.data[0].url
# Save to output_dir / f"broll_generated_{index}.png"
```

**Routing logic per scene:**
```
if scene["visual_type"] == "talking_head":
    skip — no visual needed, keep original footage

elif scene["visual_type"] == "broll_video":
    try _fetch_pexels_video()
    if None: try _fetch_pexels_image()
    if None: try _generate_dalle_image()

elif scene["visual_type"] == "broll_image":
    try _fetch_pexels_image()
    if None: try _generate_dalle_image()

elif scene["visual_type"] == "text_card":
    skip — Remotion renders this from text alone
```

**Add to each scene dict:**
```python
scene["visual_path"] = local_path_of_downloaded_file  # or None
scene["visual_src"]  = filename_only                  # for Remotion public/ reference
```

**Print for each scene:**
```
    ✔ Scene {i}: '{concept}' → {filename} (pexels_video|pexels_image|dalle|skipped)
    ✗ Scene {i}: No visual found for '{concept}' — will show talking head
```

**Return:** enriched scenes list with visual_path and visual_src added to each scene.

---

### `pipeline/steps/prepare_remotion.py`

**Purpose:** Copy all visual files to `remotion/public/visuals/`. Write `remotion/public/remotion_data.json`. This is the handoff from Python to Remotion.

**Function signature:**
```python
def prepare_remotion(
    transcript: dict,
    analysis: dict,
    scenes_with_visuals: list,
    video_path: Path,
    pipeline_output_dir: Path,
    remotion_public_dir: Path
) -> Path:
```

**Implementation requirements:**

1. Create `remotion_public_dir / "visuals"` directory if it does not exist

2. Copy input video:
   ```python
   shutil.copy(video_path, remotion_public_dir / "visuals" / "input.mp4")
   ```

3. Copy each visual file that exists:
   ```python
   for scene in scenes_with_visuals:
       if scene.get("visual_path") and Path(scene["visual_path"]).exists():
           src = Path(scene["visual_path"])
           dst = remotion_public_dir / "visuals" / src.name
           shutil.copy(src, dst)
           scene["remotion_visual_src"] = f"visuals/{src.name}"
       else:
           scene["remotion_visual_src"] = None
   ```

4. Get video duration using ffprobe:
   ```python
   FFPROBE = "/opt/homebrew/opt/ffmpeg-full/bin/ffprobe"
   result = subprocess.run([
       FFPROBE, "-v", "error",
       "-show_entries", "format=duration",
       "-of", "json", str(video_path)
   ], capture_output=True, text=True)
   duration = float(json.loads(result.stdout)["format"]["duration"])
   ```

5. Build and write `remotion_data.json`:
   ```json
   {
     "video": {
       "src": "visuals/input.mp4",
       "duration_seconds": 72.4,
       "fps": 30,
       "width": 1920,
       "height": 1080
     },
     "words": [...transcript["words"]],
     "scenes": [...scenes_with_visuals with remotion_visual_src added],
     "stat_overlays": [...analysis["stat_overlays"]],
     "suggested_cuts": [...analysis["suggested_cuts"]],
     "suggested_caption": "...",
     "hashtags": "...",
     "suggested_title": "...",
     "overall_mood": "..."
   }
   ```

6. Write to `remotion_public_dir / "remotion_data.json"` with `indent=2`

7. Print:
   ```
       ✔ remotion_data.json written
       ✔ {n} visual files copied to remotion/public/visuals/
       
     Next step: cd ../remotion && npx remotion preview
   ```

8. Return path to written JSON file

---

### `pipeline/demo.py` — Main Orchestrator

**Complete implementation:**

```python
#!/usr/bin/env python3
"""
FitMantra Video Pipeline — Demo
Processes a raw video through transcription, AI analysis,
visual fetching, and prepares data for Remotion rendering.
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# ── Constants ─────────────────────────────────────────────────────────────────
FFPROBE     = "/opt/homebrew/opt/ffmpeg-full/bin/ffprobe"
INPUT_VIDEO = Path("input/test-video.mp4")
OUTPUT_DIR  = Path("output")
REMOTION_PUBLIC = Path("../remotion/public")

OUTPUT_DIR.mkdir(exist_ok=True)

# ── Clients ───────────────────────────────────────────────────────────────────
client     = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
PEXELS_KEY = os.getenv("PEXELS_API_KEY")

# ── Imports from steps ────────────────────────────────────────────────────────
from steps.extract_audio   import extract_audio
from steps.transcribe      import transcribe
from steps.analyse         import analyse
from steps.fetch_visuals   import fetch_visuals
from steps.prepare_remotion import prepare_remotion


def get_duration(video_path: Path) -> float:
    """Get video duration in seconds using ffprobe."""
    result = subprocess.run([
        FFPROBE, "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json", str(video_path)
    ], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")
    return float(json.loads(result.stdout)["format"]["duration"])


def check_duration(video_path: Path, max_seconds: int = 600) -> float:
    """Validate video is within acceptable length for testing."""
    duration = get_duration(video_path)
    if duration > max_seconds:
        raise ValueError(
            f"Video too long: {duration:.0f}s. "
            f"Maximum for testing is {max_seconds}s."
        )
    return duration


def use_cached() -> bool:
    """Return True if cached transcript and analysis exist."""
    return (
        (OUTPUT_DIR / "transcript.json").exists() and
        (OUTPUT_DIR / "analysis.json").exists()
    )


def main() -> None:
    print("=" * 60)
    print("  FitMantra Video Pipeline")
    print("=" * 60)

    # Validate input
    if not INPUT_VIDEO.exists():
        print(f"\n  ✗ Video not found: {INPUT_VIDEO}")
        print("  Add your video file to pipeline/input/")
        sys.exit(1)

    duration = check_duration(INPUT_VIDEO)
    print(f"\n  Input : {INPUT_VIDEO}")
    print(f"  Length: {duration:.1f}s ({duration/60:.1f} min)")

    # ── STEP 1: Extract audio ─────────────────────────────────────────────────
    print("\n[1/5] Extracting audio...")
    audio_path = extract_audio(INPUT_VIDEO, OUTPUT_DIR)

    # ── STEP 2: Transcribe ────────────────────────────────────────────────────
    # To skip API call and reuse cached data, set SKIP_API=1 in .env
    if os.getenv("SKIP_API") == "1" and use_cached():
        print("\n[2/5] Loading cached transcript...")
        with open(OUTPUT_DIR / "transcript.json") as f:
            transcript = json.load(f)
        print(f"    ✔ Loaded {len(transcript['words'])} words from cache")
    else:
        print("\n[2/5] Transcribing with Whisper...")
        transcript = transcribe(audio_path, OUTPUT_DIR, client)

    # ── STEP 3: Analyse ───────────────────────────────────────────────────────
    if os.getenv("SKIP_API") == "1" and use_cached():
        print("\n[3/5] Loading cached analysis...")
        with open(OUTPUT_DIR / "analysis.json") as f:
            analysis = json.load(f)
        print(f"    ✔ Loaded analysis from cache")
    else:
        print("\n[3/5] Analysing with GPT-4o...")
        analysis = analyse(transcript, OUTPUT_DIR, client)

    # ── STEP 4: Fetch visuals ─────────────────────────────────────────────────
    print("\n[4/5] Fetching visuals...")
    scenes_with_visuals = fetch_visuals(
        analysis["scenes"], OUTPUT_DIR, PEXELS_KEY, client
    )

    # ── STEP 5: Prepare Remotion data ─────────────────────────────────────────
    print("\n[5/5] Preparing Remotion data...")
    remotion_json = prepare_remotion(
        transcript=transcript,
        analysis=analysis,
        scenes_with_visuals=scenes_with_visuals,
        video_path=INPUT_VIDEO,
        pipeline_output_dir=OUTPUT_DIR,
        remotion_public_dir=REMOTION_PUBLIC,
    )

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  PIPELINE COMPLETE")
    print("=" * 60)
    print(f"\n  📄 Transcript  : {OUTPUT_DIR}/transcript.json")
    print(f"  📊 Analysis    : {OUTPUT_DIR}/analysis.json")
    print(f"  🎬 Remotion    : {remotion_json}")

    print(f"\n  ✂️  Suggested cuts ({len(analysis['suggested_cuts'])}):")
    for cut in analysis["suggested_cuts"]:
        print(f"     {cut['start']:.1f}s–{cut['end']:.1f}s  "
              f"{cut['reason']}  ({cut['confidence']:.0%})")

    print(f"\n  🎞️  Scenes ({len(scenes_with_visuals)}):")
    for i, scene in enumerate(scenes_with_visuals):
        visual = scene.get("visual_src", "talking head")
        print(f"     {scene['start']:.0f}s–{scene['end']:.0f}s  "
              f"[{scene['tone']}]  {visual}")

    print(f"\n  📝 Caption: {analysis['suggested_caption'][:80]}...")
    print(f"  🎬 Title  : {analysis['suggested_title']}")
    print(f"\n  Next: cd ../remotion && npx remotion preview")
    print("=" * 60)


if __name__ == "__main__":
    main()
```

**Note on `SKIP_API`:** Add `SKIP_API=1` to `.env` during development to reuse cached transcript and analysis. Remove it when processing a new video.

---

## Remotion Renderer — Complete Specification

### Setup Commands

Run these once inside the `remotion/` directory:

```bash
cd remotion
npx create-video@latest .
# Select: TypeScript, yes to all defaults
npm install
```

---

### `remotion/src/types.ts` — Shared Types

```typescript
export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface Scene {
  start: number;
  end: number;
  tone: "educational" | "inspirational" | "cautionary" | "conversational";
  visual_type: "talking_head" | "broll_image" | "broll_video" | "text_card";
  visual_concept: string;
  transition_in: "fade" | "slide_left" | "slide_right" | "zoom_in";
  transition_out: "fade" | "slide_left" | "slide_right" | "zoom_out";
  narration_summary: string;
  remotion_visual_src: string | null;
}

export interface StatOverlay {
  timestamp: number;
  text: string;
  duration: number;
}

export interface RemotionData {
  video: {
    src: string;
    duration_seconds: number;
    fps: number;
    width: number;
    height: number;
  };
  words: Word[];
  scenes: Scene[];
  stat_overlays: StatOverlay[];
  suggested_cuts: Array<{
    start: number;
    end: number;
    reason: string;
    confidence: number;
  }>;
  suggested_caption: string;
  hashtags: string;
  suggested_title: string;
  overall_mood: "calm" | "energetic" | "serious" | "inspirational";
}
```

---

### `remotion/src/Root.tsx` — Composition Registration

```tsx
import { Composition } from "remotion";
import { MainVideo } from "./compositions/MainVideo";
import type { RemotionData } from "./types";

// Import data — in preview this comes from public/remotion_data.json
// In render it is passed via --props
import data from "../public/remotion_data.json";

export const RemotionRoot: React.FC = () => {
  const fps = data.video.fps;
  const durationInFrames = Math.ceil(data.video.duration_seconds * fps);

  return (
    <Composition
      id="MainVideo"
      component={MainVideo}
      durationInFrames={durationInFrames}
      fps={fps}
      width={data.video.width}
      height={data.video.height}
      defaultProps={{ data: data as RemotionData }}
    />
  );
};
```

---

### `remotion/src/index.ts`

```typescript
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
registerRoot(RemotionRoot);
```

---

### `remotion/src/compositions/MainVideo.tsx`

**Purpose:** Master composition. Layers all components in correct z-order.

**Layer order (bottom to top):**
1. Original talking head video (always visible)
2. B-roll / image overlays at scene timestamps
3. Stat card text overlays
4. Subtitles (always on top, never obscured)

```tsx
import { AbsoluteFill, Video, staticFile, useVideoConfig } from "remotion";
import { Subtitles } from "./Subtitles";
import { BRoll } from "./BRoll";
import { StatCard } from "./StatCard";
import type { RemotionData } from "../types";

interface Props {
  data: RemotionData;
}

export const MainVideo: React.FC<Props> = ({ data }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>

      {/* Layer 1 — Original video */}
      <AbsoluteFill>
        <Video
          src={staticFile(data.video.src)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* Layer 2 — B-roll scene overlays */}
      {data.scenes
        .filter(s => s.remotion_visual_src !== null)
        .map((scene, i) => (
          <BRoll key={i} scene={scene} fps={fps} />
        ))}

      {/* Layer 3 — Stat overlays */}
      {data.stat_overlays.map((stat, i) => (
        <StatCard key={i} stat={stat} fps={fps} />
      ))}

      {/* Layer 4 — Subtitles (always topmost) */}
      <Subtitles words={data.words} fps={fps} />

    </AbsoluteFill>
  );
};
```

---

### `remotion/src/compositions/Subtitles.tsx`

**Purpose:** Render animated word-by-word subtitles. Current word highlighted in yellow. Previous words gray. Upcoming words white. Bottom-center positioned. Pill-shaped semi-transparent background.

**Exact visual spec:**
- Position: bottom center, 80px from bottom edge
- Font: Arial, bold, 64px
- Current word color: `#FFE135` (yellow)
- Past word color: `#999999` (gray)
- Upcoming word color: `#FFFFFF` (white)
- Background: `rgba(0, 0, 0, 0.55)` pill shape behind entire chunk
- Current word: slight scale pop animation (0.9 → 1.0 over 3 frames)
- Chunk size: 6 words maximum
- Text shadow: `0 2px 8px rgba(0,0,0,0.9)`

```tsx
import {
  useCurrentFrame,
  AbsoluteFill,
  interpolate,
  Easing,
} from "remotion";
import type { Word } from "../types";

interface Props {
  words: Word[];
  fps: number;
}

export const Subtitles: React.FC<Props> = ({ words, fps }) => {
  const frame = useCurrentFrame();
  const currentTime = frame / fps;

  // Find index of currently spoken word
  const currentIndex = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  );

  // If no active word, find the most recently spoken word
  const activeIndex =
    currentIndex !== -1
      ? currentIndex
      : words.reduce((best, w, i) => {
          return w.end <= currentTime ? i : best;
        }, -1);

  if (activeIndex === -1) return null;

  // Build chunk of 6 words: 2 before active, active, 3 after
  const chunkStart = Math.max(0, activeIndex - 2);
  const chunkEnd = Math.min(words.length, chunkStart + 6);
  const chunk = words.slice(chunkStart, chunkEnd);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 80,
        pointerEvents: "none",
      }}
    >
      {/* Background pill */}
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.55)",
          borderRadius: 16,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 24,
          paddingRight: 24,
          maxWidth: "88%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {chunk.map((word, i) => {
          const globalIndex = chunkStart + i;
          const isActive = globalIndex === activeIndex;
          const isPast = globalIndex < activeIndex;

          // Pop scale on active word
          const scale = isActive
            ? interpolate(
                frame,
                [word.start * fps, word.start * fps + 3],
                [0.88, 1.0],
                {
                  easing: Easing.out(Easing.ease),
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }
              )
            : 1;

          const color = isActive
            ? "#FFE135"
            : isPast
            ? "#999999"
            : "#FFFFFF";

          return (
            <span
              key={`${globalIndex}-${word.word}`}
              style={{
                fontSize: 64,
                fontFamily: "Arial, sans-serif",
                fontWeight: "bold",
                color,
                textShadow: "0 2px 8px rgba(0,0,0,0.9)",
                transform: `scale(${scale})`,
                display: "inline-block",
                lineHeight: 1.2,
                letterSpacing: -0.5,
              }}
            >
              {word.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

---

### `remotion/src/compositions/BRoll.tsx`

**Purpose:** Render a b-roll image or video clip overlay for a scene. Covers full screen with `objectFit: cover`. Fades in over 20 frames. Fades out over 20 frames. Ken Burns slow zoom (1.0 → 1.08 scale over scene duration). Vignette overlay (dark edges, clear center). Opacity: 0.88 at full opacity so talking head is slightly visible underneath.

```tsx
import {
  useCurrentFrame,
  AbsoluteFill,
  Img,
  Video,
  staticFile,
  interpolate,
  Easing,
} from "remotion";
import type { Scene } from "../types";

interface Props {
  scene: Scene;
  fps: number;
}

export const BRoll: React.FC<Props> = ({ scene, fps }) => {
  const frame = useCurrentFrame();
  const currentTime = frame / fps;

  // Only render during this scene's time window
  if (currentTime < scene.start || currentTime > scene.end) {
    return null;
  }

  const sceneDuration = scene.end - scene.start;
  const sceneFrame = frame - scene.start * fps;
  const totalSceneFrames = sceneDuration * fps;
  const FADE_FRAMES = 20;

  // Opacity: fade in, hold at 0.88, fade out
  const opacity = interpolate(
    sceneFrame,
    [0, FADE_FRAMES, totalSceneFrames - FADE_FRAMES, totalSceneFrames],
    [0, 0.88, 0.88, 0],
    {
      easing: Easing.ease,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Ken Burns: slow zoom from 1.0 to 1.08
  const scale = interpolate(
    sceneFrame,
    [0, totalSceneFrames],
    [1.0, 1.08],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  if (!scene.remotion_visual_src) return null;

  const isVideo = scene.remotion_visual_src.endsWith(".mp4");

  return (
    <AbsoluteFill style={{ opacity }}>

      {/* Visual layer with Ken Burns zoom */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {isVideo ? (
          <Video
            src={staticFile(scene.remotion_visual_src)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            volume={0}
          />
        ) : (
          <Img
            src={staticFile(scene.remotion_visual_src)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </AbsoluteFill>

      {/* Vignette — softens edges, keeps center clear */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, " +
            "transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

    </AbsoluteFill>
  );
};
```

---

### `remotion/src/compositions/StatCard.tsx`

**Purpose:** Show a key statistic or claim as an animated text card. Positioned top-center at 12% from top. Slides in from above. White bold text on semi-transparent dark pill background. Fades out smoothly.

```tsx
import {
  useCurrentFrame,
  AbsoluteFill,
  interpolate,
  Easing,
} from "remotion";
import type { StatOverlay } from "../types";

interface Props {
  stat: StatOverlay;
  fps: number;
}

export const StatCard: React.FC<Props> = ({ stat, fps }) => {
  const frame = useCurrentFrame();
  const currentTime = frame / fps;

  const end = stat.timestamp + stat.duration;

  if (currentTime < stat.timestamp || currentTime > end) {
    return null;
  }

  const statFrame = frame - stat.timestamp * fps;
  const totalStatFrames = stat.duration * fps;
  const FADE_FRAMES = 8;
  const SLIDE_FRAMES = 12;

  // Slide in from above
  const translateY = interpolate(
    statFrame,
    [0, SLIDE_FRAMES],
    [-40, 0],
    {
      easing: Easing.out(Easing.back(1.2)),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Fade in and out
  const opacity = interpolate(
    statFrame,
    [0, FADE_FRAMES, totalStatFrames - FADE_FRAMES, totalStatFrames],
    [0, 1, 1, 0],
    {
      easing: Easing.ease,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: "12%",
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.72)",
          borderRadius: 14,
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 36,
          paddingRight: 36,
          maxWidth: "78%",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontSize: 44,
            fontFamily: "Arial, sans-serif",
            fontWeight: "bold",
            color: "#FFFFFF",
            textShadow: "0 2px 6px rgba(0,0,0,0.8)",
            lineHeight: 1.3,
          }}
        >
          {stat.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
```

---

### `remotion/src/compositions/Intro.tsx`

**Purpose:** Branded 3-second intro screen. Dark background. FitMantra logo text. Tagline. Fade in then hold.

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0F1923",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 16,
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontFamily: "Arial, sans-serif",
          fontWeight: "bold",
          color: "#2E8FBF",
          letterSpacing: -2,
        }}
      >
        FitMantra
      </div>
      <div
        style={{
          fontSize: 36,
          fontFamily: "Arial, sans-serif",
          color: "#AAAAAA",
          letterSpacing: 2,
        }}
      >
        NUTRITION · WELLNESS · LIFE
      </div>
    </AbsoluteFill>
  );
};
```

---

### `remotion/remotion.config.ts`

```typescript
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setCrf(18);
```

---

## `render.sh` — One Command to Run Everything

```bash
#!/bin/bash
set -e

echo ""
echo "═══════════════════════════════════════════════════"
echo "  FitMantra Video Pipeline — Full Render"
echo "═══════════════════════════════════════════════════"

# ── Step 1: Python pipeline ──────────────────────────────────────────────────
echo ""
echo "  [1/2] Running Python pipeline..."
cd pipeline
source venv/bin/activate
python demo.py
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
```

Make executable: `chmod +x render.sh`

---

## Development Workflow

### First-Time Setup

```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/fitmantra-video-pipeline.git
cd fitmantra-video-pipeline

# 2. Python setup
cd pipeline
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your API keys

# 3. Remotion setup
cd ../remotion
npm install

# 4. Add test video
cp /path/to/your/video.mp4 ../pipeline/input/test-video.mp4
```

### Daily Development Cycle

```bash
# Run Python pipeline only (generates remotion_data.json)
cd pipeline && source venv/bin/activate && python demo.py

# Preview in Remotion (live browser preview, hot reload)
cd remotion && npx remotion preview

# To skip API calls and reuse cached transcript/analysis:
# Add SKIP_API=1 to pipeline/.env

# Full render both formats
./render.sh
```

### Testing Without API Cost

Add `SKIP_API=1` to `pipeline/.env`. The pipeline will use cached `transcript.json` and `analysis.json` from the last real API call. Only Pexels calls (free) are made. Cost: $0.

Remove `SKIP_API=1` when processing a new video.

---

## Data Flow Summary

```
pipeline/input/test-video.mp4
         │
         ▼  [FFmpeg extracts audio]
pipeline/output/audio.mp3
         │
         ▼  [OpenAI Whisper]
pipeline/output/transcript.json        { words: [{word, start, end}] }
         │
         ▼  [OpenAI GPT-4o]
pipeline/output/analysis.json          { scenes, cuts, stats, caption }
         │
         ▼  [Pexels API + DALL-E]
pipeline/output/broll_*.jpg/mp4        visual files downloaded
         │
         ▼  [prepare_remotion.py]
remotion/public/remotion_data.json     complete data for Remotion
remotion/public/visuals/               all visual files copied here
         │
         ▼  [Remotion renderer]
pipeline/output/final_16x9.mp4         YouTube format
pipeline/output/final_9x16.mp4         Instagram Reels format
```

---

## Error Handling Reference

| Error | Likely Cause | Fix |
|---|---|---|
| `ffmpeg: command not found` | Wrong binary path | Use `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg` |
| `ass filter not found` | Regular ffmpeg, not ffmpeg-full | `brew install ffmpeg-full` |
| `OpenAI API error 401` | Invalid API key | Check `.env` file |
| `Pexels 403` | Invalid API key | Check `.env` file |
| `remotion_data.json not found` | Python pipeline not run | Run `python demo.py` first |
| `Video file not found` | Wrong input path | Check `pipeline/input/test-video.mp4` exists |
| `Module not found` in Remotion | Missing npm package | `cd remotion && npm install` |

---

## Phase 2 — Automation (After Prototype Works)

Once the local prototype produces good output, add these layers in order:

```
Week 2    Railway deployment of Python worker
          Google Drive trigger via n8n
          WhatsApp notification via AiSensy when processing complete

Week 3    Supabase job tracking database
          Job status API endpoint
          Error alerting to admin WhatsApp

Week 4    Vercel review UI
          Approve/reject cuts and visuals
          Edit caption before posting

Week 5    Buffer API for auto-scheduling posts
          Remotion Lambda for cloud rendering (optional)
          Full pipeline documented in Notion
```

---

## Commit Message Convention

```
feat(pipeline): add DALL-E fallback for missing Pexels visuals
fix(remotion): correct subtitle chunk boundary calculation
chore(deps): update openai to 1.40.0
docs(readme): add daily development workflow section
refactor(broll): extract fade logic into shared utility
```

---

*End of build instructions. Every section is complete and implementable. Do not add features not specified here. Do not change the data contract structure. Build in the order specified.*
