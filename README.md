# FitMantra Video Pipeline

Automated video editing pipeline that takes a raw talking-head MP4 and produces a polished video with captions, B-roll overlays, stat cards, and an outro — ready for Remotion rendering.

## Architecture

```
Stage 1 — Python Pipeline          Stage 2 — Remotion Renderer
┌─────────────────────────┐        ┌───────────────────────────┐
│  extract_audio.py       │        │  MainVideo.tsx            │
│  transcribe.py (Whisper)│        │    ├── Video (layer 1)    │
│  analyse.py (Gemini)    │──────▶ │    ├── BRoll (layer 2)    │
│  fetch_visuals.py       │  JSON  │    ├── StatCard (layer 3) │
│  prepare_remotion.py    │        │    ├── Captions (layer 4) │
└─────────────────────────┘        │    ├── Logo (layer 5)     │
                                   │    └── Outro (layer 6)    │
                                   └───────────────────────────┘
```

### Pipeline Steps

| Step | File | Description |
|------|------|-------------|
| 1 | `extract_audio.py` | Extracts audio track as MP3 via FFmpeg |
| 2 | `transcribe.py` | Speech-to-text with faster-whisper (word-level timestamps) |
| 3 | `analyse.py` | Gemini 2.5 Flash analyses transcript → scenes, cuts, B-roll concepts, stats, captions |
| 4 | `fetch_visuals.py` | Downloads B-roll clips from Pexels API matching each scene's concept |
| 5 | `prepare_remotion.py` | Copies assets, converts HEVC→H.264, writes remotion_data.json |

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- FFmpeg (with libx264)

### API Keys

| Variable | Get From | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey) | Scene analysis, caption generation |
| `PEXELS_API_KEY` | [pexels.com/api](https://www.pexels.com/api/) | Royalty-free stock video clips |

### Installation

```bash
# 1. Python dependencies
pip install -r pipeline/requirements.txt

# 2. Configure API keys
cp pipeline/.env.example pipeline/.env
# Edit pipeline/.env — add your GEMINI_API_KEY and PEXELS_API_KEY

# 3. Remotion dependencies
cd remotion && npm install && cd ..

# 4. Place your input video
copy your-video.mp4 pipeline\input\
# Then edit pipeline/demo.py → set INPUT_VIDEO
```

## Usage

### Run the pipeline

```bash
cd pipeline
python demo.py --use-api
```

### Preview in Remotion Studio

```bash
cd remotion
node node_modules/@remotion/cli/remotion-cli.js studio
# Open http://localhost:3000
```

### Full render

```bash
cd remotion
node node_modules/@remotion/cli/remotion-cli.js render MainVideo out/video.mp4
```

## Project Structure

```
fitmantra-video-pipeline/
├── pipeline/                # Python pipeline
│   ├── demo.py              # Entry point
│   ├── steps/               # Pipeline steps
│   │   ├── extract_audio.py
│   │   ├── transcribe.py
│   │   ├── analyse.py
│   │   ├── fetch_visuals.py
│   │   └── prepare_remotion.py
│   ├── input/               # Place source videos here (gitignored)
│   └── output/              # Generated outputs (gitignored)
├── remotion/                # Remotion rendering project
│   ├── src/
│   │   ├── Root.tsx         # Composition root
│   │   ├── compositions/    # React components
│   │   │   ├── MainVideo.tsx
│   │   │   ├── BRoll.tsx
│   │   │   └── StatCard.tsx
│   │   ├── brand/           # Branding components
│   │   └── types.ts         # TypeScript interfaces
│   └── public/              # Static assets
├── predefined-components/   # Reusable Remotion components
├── .gitignore
└── README.md
```
