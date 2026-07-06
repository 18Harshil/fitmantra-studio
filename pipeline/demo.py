#!/usr/bin/env python3
"""
FitMantra Video Pipeline — Demo
Processes a raw video through transcription, Gemini AI analysis,
and prepares data for Remotion rendering.

Usage:
    python3 demo.py              # Offline mode — use cached output files
    python3 demo.py --use-api    # Call Gemini API for analysis
"""

import argparse
import os
import sys
import json
import subprocess
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Constants ─────────────────────────────────────────────────────────────────
FFPROBE     = "ffprobe"
# Pick the first .mp4 in input/
_inputs = sorted(Path("input").glob("*.mp4"))
INPUT_VIDEO = _inputs[0] if _inputs else Path("input/PLACE_VIDEO_HERE.mp4")
OUTPUT_DIR  = Path("output")
REMOTION_PUBLIC = Path("../remotion/public")

OUTPUT_DIR.mkdir(exist_ok=True)

# ── Imports from steps ────────────────────────────────────────────────────────
from steps.extract_audio   import extract_audio
from steps.transcribe      import transcribe
from steps.analyse         import analyse
from steps.clean_video     import clean_video
from steps.prepare_remotion import prepare_remotion


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="FitMantra Video Pipeline — process raw video for Remotion."
    )
    parser.add_argument(
        "--use-api",
        action="store_true",
        default=False,
        help=(
            "Call Google Gemini for analysis (Gemini 2.5 Flash). "
            "Without this flag the pipeline loads from previously cached "
            "output files (transcript.json, analysis.json)."
        ),
    )
    # Keep legacy flag as alias for backwards compatibility
    parser.add_argument(
        "--use-openai",
        action="store_true",
        default=False,
        dest="use_api_legacy",
        help=argparse.SUPPRESS,
    )
    return parser.parse_args()


def get_duration(video_path: Path) -> float:
    """Get video duration in seconds using ffprobe."""
    result = subprocess.run(
        [
            FFPROBE, "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json", str(video_path),
        ],
        capture_output=True,
        text=True,
    )
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


def _has_cached_files() -> bool:
    """Return True if all essential cached output files exist."""
    return (
        (OUTPUT_DIR / "transcript.json").exists() and
        (OUTPUT_DIR / "analysis.json").exists()
    )





def main() -> None:
    args = parse_args()
    use_api = args.use_api or args.use_api_legacy

    print("=" * 60)
    print("  FitMantra Video Pipeline")
    print(f"  Mode: {'🌐 API (Gemini 2.5 Flash)' if use_api else '📦 Offline (cached files)'}")
    print("=" * 60)

    # Validate input
    if not INPUT_VIDEO.exists():
        print(f"\n  ✗ Video not found: {INPUT_VIDEO}")
        print("  Add your video file to pipeline/input/")
        sys.exit(1)

    duration = check_duration(INPUT_VIDEO)
    print(f"\n  Input : {INPUT_VIDEO}")
    print(f"  Length: {duration:.1f}s ({duration/60:.1f} min)")

    # ── Initialise Gemini client only when needed ──────────────────────────
    gemini_client = None
    if use_api:
        from google import genai
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            print("\n  ✗ GEMINI_API_KEY not found in .env")
            print("  Add your Gemini API key to pipeline/.env")
            sys.exit(1)
        gemini_client = genai.Client(api_key=gemini_api_key)

    # ── STEP 1: Extract audio ─────────────────────────────────────────────────
    print("\n[1/5] Extracting audio...")
    audio_path = extract_audio(INPUT_VIDEO, OUTPUT_DIR)

    # ── STEP 2: Transcribe ────────────────────────────────────────────────────
    if use_api:
        print("\n[2/5] Transcribing with faster_whisper...")
        transcript = transcribe(audio_path, OUTPUT_DIR, gemini_client)
    else:
        if not (OUTPUT_DIR / "transcript.json").exists():
            print("\n  ✗ No cached transcript.json found.")
            print("  Run with --use-api first to generate it.")
            sys.exit(1)
        print("\n[2/5] Loading cached transcript...")
        with open(OUTPUT_DIR / "transcript.json") as f:
            transcript = json.load(f)
        print(f"    ✔ Loaded {len(transcript['words'])} words from cache")

    # ── STEP 3: Analyse ───────────────────────────────────────────────────────
    if use_api:
        print("\n[3/5] Analysing with Gemini 2.5 Flash...")
        analysis = analyse(transcript, OUTPUT_DIR, gemini_client)
    else:
        if not (OUTPUT_DIR / "analysis.json").exists():
            print("\n  ✗ No cached analysis.json found.")
            print("  Run with --use-api first to generate it.")
            sys.exit(1)
        print("\n[3/5] Loading cached analysis...")
        with open(OUTPUT_DIR / "analysis.json") as f:
            analysis = json.load(f)
        print(f"    ✔ Loaded analysis from cache")

    # ── STEP 4: Clean video (remove dead space + suggested cuts) ─────────────
    print("\n[4/5] Cleaning video...")
    video_path, transcript, analysis = clean_video(
        video_path=INPUT_VIDEO,
        transcript=transcript,
        analysis=analysis,
        output_dir=OUTPUT_DIR,
    )

    # ── STEP 5: Prepare Remotion data ─────────────────────────────────────────
    print("\n[5/5] Preparing Remotion data...")
    remotion_json = prepare_remotion(
        transcript=transcript,
        analysis=analysis,
        video_path=video_path,
        pipeline_output_dir=OUTPUT_DIR,
        remotion_public_dir=REMOTION_PUBLIC,
        gemini_client=gemini_client,
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

    print(f"\n  🎞️  Scenes ({len(analysis['scenes'])}):")
    for i, scene in enumerate(analysis["scenes"]):
        start = scene.get("start")
        end = scene.get("end")
        tone = scene.get("tone", "unknown")
        vtype = scene.get("visual_type", "talking_head")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            time_range = f"{start:.0f}s–{end:.0f}s"
        else:
            time_range = "unknown-range"
        print(f"     {time_range}  [{tone}]  {vtype}")

    print(f"\n  📝 Caption: {analysis['suggested_caption'][:80]}...")
    print(f"  🎬 Title  : {analysis['suggested_title']}")
    print(f"\n  Next: cd ../remotion && node node_modules/@remotion/cli/remotion-cli.js studio")
    print("=" * 60)


if __name__ == "__main__":
    main()