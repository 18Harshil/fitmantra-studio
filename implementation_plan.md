# Integrate Predefined Brand Components into Video Pipeline

## Background

The project has **two separate Remotion projects** that need to be unified:

1. **`remotion/`** — The main pipeline renderer. Uses a JSON data contract (`remotion_data.json`) fed by the Python pipeline. Has **basic placeholder components**: `Subtitles.tsx` (simple word-by-word, Arial font), `BRoll.tsx` (generic Ken Burns), `StatCard.tsx`, `Intro.tsx`. These are functional but visually basic.

2. **`predefined-components/git-test-remo-1/`** — A standalone prototyping project where **polished, brand-quality components** have been hand-crafted. These are the real deal that should be used in production.

### Predefined Components — Classification

| Component | Type | Description |
|---|---|---|
| [FitMantraLogo.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/FitMantraLogo.tsx) | 🔵 Brand (reuse everywhere) | Renders `logo.png` from static files. Circular, configurable `size` prop |
| [FitMantraOutro.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/FitMantraOutro.tsx) | 🔵 Brand (reuse everywhere) | Dark-green gradient bg + centered logo with scale-in animation + final fade |
| [BrandOutro.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/BrandOutro.tsx) | 🔵 Brand (reuse everywhere) | Plays `outro.mp4` video with fade in/out. `OUTRO_DURATION_SECONDS = 4.78` exported as constant |
| [FitMantraCaptions.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/FitMantraCaptions.tsx) | 🔵 Brand (reuse everywhere) | TikTok-style captions using `@remotion/captions`. Montserrat 900 font, `#00FF00` keyword highlights, pop animations. Reads `captions.json` from static files |
| [FitMantraReelsCaptions.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/FitMantraReelsCaptions.tsx) | 🔵 Brand (reuse everywhere) | Elegant serif-style captions for Reels format. Lora/Bell MT font, `#00C853` keyword highlights. Also reads `captions.json` |
| [FitMantraBroll.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/FitMantraBroll.tsx) | 🟡 Reference pattern | B-roll with precise ms-level timing, `trimSeconds` support, vignette, cross-fade. Currently hardcoded cutaway array — needs to be data-driven |
| [PcosReels.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/PcosReels.tsx) | 🟠 Video-specific (reference) | Full reel composition: speech segments with cuts, caption time-remapping, cutaways, soft blobs, gradient overlays, logo, outro. Shows the "gold standard" architecture for a reel |
| [PcosVitaminD.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/PcosVitaminD.tsx) | 🟠 Video-specific (reference) | Similar to PcosReels but with crossfade between speech segments, text card overlays, and B-roll visual overlays |
| [TripleTrimReel.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/TripleTrimReel.tsx) | 🟠 Video-specific (reference) | Product ad reel — multi-scene product showcase with premium backdrop, light sweeps, film grain. No talking head |
| [FitMantraShort.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/FitMantraShort.tsx) | 🟠 Video-specific (reference) | Simple short composition: speaker video + FitMantraBroll + FitMantraReelsCaptions + BrandOutro + TopRightLogo |
| [ShortsEdit.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/ShortsEdit.tsx) | 🟠 Video-specific (reference) | YouTube Shorts style: blurred bg + floating rounded video card + punch zoom on phrase boundaries + hook badge + progress bar |
| [PinkPositiveGraph.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/PinkPositiveGraph.tsx) | 🟠 Video-specific (reference) | Custom animated graph overlay used as a "custom:" b-roll in PcosReels |
| [TopicVisuals.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/TopicVisuals.tsx) | 🟠 Video-specific (reference) | SVG icons (muscle, barbell, moon, smile, lightning) that appear at topic timestamps |
| [CoffeeAd.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/predefined-components/git-test-remo-1/src/CoffeeAd.tsx) | 🟠 Video-specific (reference) | Unrelated coffee ad demo — ignore for FitMantra pipeline |

---

## User Review Required

> [!IMPORTANT]
> **Captions format change**: The predefined captions components use `@remotion/captions` with a `captions.json` file format (from Remotion's transcription API), while the current pipeline produces `words[]` array from OpenAI Whisper with `{word, start, end}` format. We need to either:
> - **(A)** Convert Whisper output → `@remotion/captions` Caption format in `prepare_remotion.py` (recommended — keeps the polished caption components as-is)
> - **(B)** Rewrite the brand caption components to accept the current `words[]` format

> [!IMPORTANT]
> **Outro selection**: There are two outro components:
> - `FitMantraOutro` — Pure Remotion (animated gradient + logo image, no external video needed)
> - `BrandOutro` — Plays an `outro.mp4` video file (requires the video asset)
>
> Which should be used as the default? Or should both be available and selected via `remotion_data.json`?

> [!IMPORTANT]
> **B-roll asset strategy**: The predefined components reference B-roll clips from `broll/`, `broll-pcos/`, `broll-v3/`, `broll-v4/`, `broll-v5/` directories in `public/`. For the automated pipeline, should we:
> - **(A)** Keep using Pexels/DALL-E as-is for auto-fetched B-roll, and only add support for manually-specified B-roll via `remotion_data.json`
> - **(B)** Build a local B-roll library system where you curate clips and the pipeline selects from them

---

## Open Questions

> [!IMPORTANT]
> **Keywords list**: The caption components highlight specific keywords (e.g., `weight`, `muscle`, `sleep`, `energy`). Each video-specific composition defines its own keyword set. Should the keywords:
> - **(A)** Be generated dynamically by GPT-4o in the `analysis.json` and passed via `remotion_data.json`
> - **(B)** Use a static brand-level keyword list
> - **(C)** Both — static brand defaults + GPT-generated per-video additions

> [!IMPORTANT]
> **Caption style per format**: There are two caption styles — `FitMantraCaptions` (bold Montserrat, lime green, for Shorts/YouTube) and `FitMantraReelsCaptions` (elegant Lora, green, for Reels). Should the pipeline auto-select based on output format (16:9 vs 9:16)?

---

## Proposed Changes

### Component 1: Brand Components (copy into `remotion/`)

Copy the battle-tested brand components from `predefined-components/` into the main `remotion/src/` tree under a new `brand/` directory.

#### [NEW] [brand/](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/brand/)
New directory for reusable brand components.

#### [NEW] FitMantraLogo.tsx
Copy from predefined, place at `remotion/src/brand/FitMantraLogo.tsx`. Also copy `logo.png` to `remotion/public/`.

#### [NEW] BrandOutro.tsx
Copy from predefined, place at `remotion/src/brand/BrandOutro.tsx`. Also copy `outro.mp4` to `remotion/public/` (if using video outro).

#### [NEW] FitMantraOutro.tsx
Copy from predefined as fallback outro that doesn't require video asset.

#### [NEW] FitMantraCaptions.tsx
Copy from predefined, place at `remotion/src/brand/FitMantraCaptions.tsx`. Modify to accept keywords as props (from `remotion_data.json`) instead of hardcoded set.

#### [NEW] FitMantraReelsCaptions.tsx
Copy from predefined for 9:16 format captions.

---

### Component 2: Data Contract Updates (`remotion_data.json`)

Extend the data contract to support the new components.

#### [MODIFY] [types.ts](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/types.ts)

Add new fields to `RemotionData`:

```typescript
export interface RemotionData {
  // ... existing fields ...
  
  // NEW: Captions in @remotion/captions format
  captions_src: string;          // path to captions.json in public/
  
  // NEW: Keywords for caption highlighting
  highlight_keywords: string[];  // e.g. ["pcos", "vitamin", "insulin"]
  
  // NEW: Outro configuration  
  outro: {
    type: "video" | "logo";      // BrandOutro vs FitMantraOutro
    duration_seconds: number;     // default 4.78 for video, 3 for logo
  };
  
  // NEW: B-roll with precise timing (ms-level)
  broll_overlays: Array<{
    from_ms: number;
    to_ms: number;
    src: string;
    trim_seconds: number;
    object_position?: string;
  }>;
  
  // NEW: Brand config
  brand: {
    logo_src: string;            // "logo.png"
    show_logo_watermark: boolean;
    logo_position: "top-right" | "top-left";
    logo_size: number;           // default 140 for 9:16, 80 for 16:9
  };
}
```

---

### Component 3: Main Composition Upgrade

#### [MODIFY] [MainVideo.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/compositions/MainVideo.tsx)

Rewrite to follow the architecture pattern from `PcosReels.tsx` / `FitMantraShort.tsx`:

```
Layer 1: Speaker video (with optional speech-segment cuts)
Layer 2: B-roll cutaway overlays (ms-level timing, fade in/out, vignette)
Layer 3: Visual polish (top backdrop gradient, bottom gradient)  
Layer 4: Stat overlays (existing)
Layer 5: Captions (FitMantraCaptions for 16:9, FitMantraReelsCaptions for 9:16)
Layer 6: Logo watermark (top-right, subtle)
Layer 7: Brand outro (appended as Sequence at end)
```

#### [DELETE/REPLACE] [Subtitles.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/compositions/Subtitles.tsx)
Replaced by `FitMantraCaptions.tsx` from brand components.

#### [MODIFY] [BRoll.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/compositions/BRoll.tsx)
Upgrade to use the more polished pattern from `FitMantraBroll.tsx` — ms-level timing, trim support, better fade curves, vignette.

#### [DELETE/REPLACE] [Intro.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/compositions/Intro.tsx)
Replaced by `FitMantraOutro.tsx` / `BrandOutro.tsx` (intro was already unused in MainVideo).

---

### Component 4: Root.tsx & Composition Registration

#### [MODIFY] [Root.tsx](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/src/Root.tsx)

Update to account for outro duration appended to the main video:

```tsx
const fps = data.video.fps;
const bodyFrames = Math.ceil(data.video.duration_seconds * fps);
const outroFrames = Math.round((data.outro?.duration_seconds ?? 4.78) * fps);
const durationInFrames = bodyFrames + outroFrames;
```

---

### Component 5: Python Pipeline Updates

#### [MODIFY] [prepare_remotion.py](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/steps/prepare_remotion.py)

1. **Convert Whisper words → `@remotion/captions` Caption format**:
   ```python
   captions = [
       {
           "text": f" {w['word']}",
           "startMs": int(w["start"] * 1000),
           "endMs": int(w["end"] * 1000),
           "timestampMs": int(w["start"] * 1000),
           "confidence": 1.0
       }
       for w in transcript["words"]
   ]
   ```
   Write to `remotion/public/captions.json`.

2. **Add new fields to `remotion_data.json`**:
   - `captions_src`, `highlight_keywords`, `outro`, `broll_overlays`, `brand`

3. **Copy brand assets** (`logo.png`, `outro.mp4`) to `remotion/public/` if they don't exist.

#### [MODIFY] [analyse.py](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/pipeline/steps/analyse.py)

Update the GPT-4o prompt to also extract:
- `highlight_keywords`: key terms for caption highlighting
- `broll_overlays`: precise ms-level B-roll timing suggestions (converting from scene-level to overlay-level)

---

### Component 6: New npm Dependencies

#### [MODIFY] [package.json](file:///Users/huzefa/FitMantra-personal/fitmantra-video-pipeline/remotion/package.json)

Add required dependencies:
```json
"@remotion/captions": "4.0.471",
"@remotion/google-fonts": "4.0.471"
```

---

### Component 7: Static Assets

#### [NEW] `remotion/public/logo.png`
Copy from wherever the logo asset lives (likely in `predefined-components/git-test-remo-1/public/logo.png`).

#### [NEW] `remotion/public/outro.mp4` (optional)
Copy the brand outro video if using `BrandOutro`.

---

## Verification Plan

### Automated Tests
```bash
# 1. TypeScript compilation check
cd remotion && npx tsc --noEmit

# 2. Python import check  
cd pipeline && python3 -c "from steps.prepare_remotion import prepare_remotion; print('OK')"

# 3. Remotion preview launch test
cd remotion && npx remotion preview --port 3123
```

### Manual Verification
1. Run `python3 demo.py` (offline mode) to regenerate `remotion_data.json` with new fields
2. Open Remotion preview to verify:
   - Brand captions rendering with keyword highlights
   - Logo watermark in top-right corner
   - Outro sequence appended after main content
   - B-roll overlays with polished fade/vignette
3. Test both 16:9 and 9:16 renders via `render.sh`
