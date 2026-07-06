# FitMantra Video Pipeline — Build Walkthrough

## Summary

Restructured the FitMantra video pipeline from a monolithic 446-line `demo.py` with FFmpeg-based rendering into a clean two-stage architecture:

- **Stage 1 — Python Pipeline** (`pipeline/`): 5 modular step files + orchestrator
- **Stage 2 — Remotion Renderer** (`remotion/`): 5 React compositions for animated video output

## Files Created / Modified

### Phase 1: Directory Restructure (10 operations)
| Operation | Path |
|---|---|
| MOVED | `demo.py` → [pipeline/demo.py](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/demo.py) |
| MOVED | `.env` → `pipeline/.env` |
| MOVED | `.env.example` → [pipeline/.env.example](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/.env.example) |
| MOVED | `requirements.txt` → [pipeline/requirements.txt](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/requirements.txt) |
| MOVED | `input/` → `pipeline/input/` |
| MOVED | `output/` → `pipeline/output/` |
| RENAMED | `remotion-test-project/` → `remotion/` |
| DELETED | `architecture.txt` |
| MODIFIED | [.gitignore](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/.gitignore) — full coverage for both stages |

### Phase 2: Python Pipeline Modules (7 files)
| File | Purpose |
|---|---|
| [steps/__init__.py](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/steps/__init__.py) | Package marker |
| [steps/extract_audio.py](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/steps/extract_audio.py) | FFmpeg audio extraction |
| [steps/transcribe.py](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/steps/transcribe.py) | OpenAI Whisper word-level transcription |
| [steps/analyse.py](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/steps/analyse.py) | GPT-4o scene planning (new `scenes` schema) |
| [steps/fetch_visuals.py](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/steps/fetch_visuals.py) | Pexels video → Pexels image → DALL-E fallback |
| [steps/prepare_remotion.py](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/steps/prepare_remotion.py) | Copies files & writes `remotion_data.json` |
| [demo.py](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/demo.py) | 5-step orchestrator (rewritten from scratch) |

### Phase 3: Remotion Compositions (8 files)
| File | Purpose |
|---|---|
| [types.ts](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/types.ts) | Shared TypeScript interfaces (data contract) |
| [Root.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/Root.tsx) | Composition registration with dynamic sizing |
| [MainVideo.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/compositions/MainVideo.tsx) | Master 4-layer composition |
| [Subtitles.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/compositions/Subtitles.tsx) | Word-by-word animated subtitles |
| [BRoll.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/compositions/BRoll.tsx) | Ken Burns b-roll overlays with vignette |
| [StatCard.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/compositions/StatCard.tsx) | Animated stat text cards |
| [Intro.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/compositions/Intro.tsx) | Branded FitMantra intro screen |
| [remotion.config.ts](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/remotion.config.ts) | h264 codec + CRF 18 quality |

### Phase 4-5: Scripts & Docs
| File | Purpose |
|---|---|
| [render.sh](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/render.sh) | One-command runner (global Python, no venv) |
| [README.md](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/README.md) | Project documentation |

## Verification Results

| Check | Result |
|---|---|
| Python imports (all 5 step modules) | ✅ Pass |
| TypeScript compilation (`tsc --noEmit`) | ✅ Pass |
| Directory structure matches spec | ✅ Match |

## Key Design Decisions

1. **No venv** — `render.sh` uses `python3` globally per user preference
2. **tsconfig fix** — Added `resolveJsonModule` and `allowSyntheticDefaultImports` so Root.tsx can import `remotion_data.json`
3. **Placeholder JSON** — Created `remotion/public/remotion_data.json` with empty data so TypeScript compiles and Remotion preview can launch before the Python pipeline runs
4. **Type cast in Root.tsx** — Used `as unknown as` cast to bridge Remotion 4.x's `LooseComponentType` constraint with our typed `Props` interface

## Next Steps

To run the pipeline end-to-end:

```bash
# 1. Run Python pipeline (requires API keys in pipeline/.env)
cd pipeline && python3 demo.py

# 2. Preview in Remotion
cd remotion && npx remotion preview

# 3. Full render
./render.sh
```

> [!NOTE]
> The old `analysis.json` (with `broll_concepts` schema) is still in `pipeline/output/`. It will be overwritten on the next pipeline run with the new `scenes`-based schema. If using `SKIP_API=1`, you'll need to run once without it to generate compatible data.
