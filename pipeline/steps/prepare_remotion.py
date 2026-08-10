"""
Copy all visual files to remotion/public/visuals/.
Write remotion/public/remotion_data.json.
This is the handoff from Python to Remotion.
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

from steps.fetch_visuals import fetch_brolls

FFPROBE = "ffprobe"
OUTRO_DURATION_SECONDS = 4.92


def _retry(desc: str, fn, attempts: int = 15, delay: float = 1.0):
    """Run fn, retrying on transient Windows file locks (WinError 32/5)."""
    import time as _time
    last = None
    for _ in range(attempts):
        try:
            return fn()
        except OSError as e:
            last = e
            _time.sleep(delay)
    raise RuntimeError(f"{desc} failed (file still locked): {last}")


def _reencode_input(video_path: Path, input_tmp: Path) -> None:
    """Re-encode the input video to H.264 + AAC with faststart (browser-safe)."""
    _probe = subprocess.run(
        ["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True, timeout=30
    )
    video_encoder = "libx264"
    encoder_args = ["-preset", "ultrafast", "-crf", "23"]
    if "h264_nvenc" in _probe.stdout:
        video_encoder = "h264_nvenc"
        encoder_args = ["-preset", "p4", "-cq", "23"]
    r = subprocess.run(
        ["ffmpeg", "-i", str(video_path),
         "-vf", "eq=gamma=1.2:contrast=1.05:brightness=0.03:saturation=1.03",
         "-pix_fmt", "yuv420p",
         "-c:v", video_encoder, *encoder_args,
         "-vsync", "cfr",
         "-c:a", "aac", "-movflags", "+faststart", "-y", str(input_tmp)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1200,
    )
    if r.returncode != 0:
        _retry("unlink tmp", lambda: input_tmp.unlink(missing_ok=True))
        raise RuntimeError(f"ffmpeg re-encode failed")


def _copy_to(input_tmp: Path, input_dst: Path) -> None:
    """Overwrite input.mp4 from the completed temp file (Windows-safe: the
    Remotion preview streams input.mp4 and locks it, so os.replace fails)."""
    def _do_copy():
        import shutil
        with open(input_tmp, "rb") as _src, open(input_dst, "wb") as _dst:
            shutil.copyfileobj(_src, _dst, 1024 * 1024)
    _retry("copy to input.mp4", _do_copy)


def _safe_unlink(p: Path):
    _retry("unlink", lambda: p.unlink(missing_ok=True))


def _verify_mp4(path: Path) -> bool:
    """Decode the whole file; returns True only if it is fully clean."""
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "null", "-"],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=1200,
    )
    return r.returncode == 0



def _ensure_pip_format(ev: dict) -> dict:
    ev["pip_format"] = ev.get("pip_format", "pip")
    return ev

def prepare_remotion(
    transcript: dict,
    analysis: dict,
    video_path: Path,
    pipeline_output_dir: Path,
    remotion_public_dir: Path,
    gemini_client=None,
) -> Path:
    """Prepare all data and files for Remotion rendering.

    Copies input video to remotion/public/visuals/,
    then writes remotion_data.json with the complete data contract.

    Args:
        transcript: Dict with 'words' and 'full_text'.
        analysis: Full analysis dict from Gemini.
        video_path: Path to the original input video.
        pipeline_output_dir: Pipeline output directory.
        remotion_public_dir: Path to remotion/public/.

    Returns:
        Path to the written remotion_data.json file.

    Raises:
        RuntimeError: If ffprobe fails to get video duration.
    """
    visuals_dir = remotion_public_dir / "visuals"
    visuals_dir.mkdir(parents=True, exist_ok=True)

    # Copy input video — re-encode to H.264 (browser compat + CFR) into a NEW
    # versioned file. The Remotion preview streams input.mp4 and holds it open,
    # so overwriting it in place races with the browser and corrupts the file.
    # A fresh unique filename each run avoids that entirely.
    import time as _time
    input_dst = visuals_dir / f"input_{int(_time.time() * 1000)}.mp4"
    input_tmp = visuals_dir / f"input_tmp_{int(_time.time() * 1000)}.mp4"
    last_err = None
    for _attempt in range(2):
        _reencode_input(video_path, input_tmp)
        try:
            _copy_to(input_tmp, input_dst)
        except Exception as e:
            last_err = e
            _safe_unlink(input_tmp)
            raise RuntimeError(f"could not write {input_dst.name}: {e}")
        _safe_unlink(input_tmp)
        if _verify_mp4(input_dst):
            break
        last_err = "input.mp4 decode check failed (retrying)"
        _safe_unlink(input_tmp)
        _safe_unlink(input_dst)
        input_dst = visuals_dir / f"input_{int(_time.time() * 1000)}.mp4"
        input_tmp = visuals_dir / f"input_tmp_{int(_time.time() * 1000)}.mp4"
    else:
        raise RuntimeError(f"{input_dst.name} corrupt after re-encode: {last_err}")

    # Captions for @remotion/captions
    captions = [
        {
            "text": f" {w['word']}",
            "startMs": int(float(w["start"]) * 1000),
            "endMs": int(float(w["end"]) * 1000),
            "timestampMs": int(float(w["start"]) * 1000),
            "confidence": 1.0,
        }
        for w in transcript.get("words", [])
    ]
    captions_path = remotion_public_dir / "captions.json"
    with open(captions_path, "w") as f:
        json.dump(captions, f, indent=2)

    # Ensure brand assets exist in Remotion public directory
    logo_src = remotion_public_dir / "logo.png"
    if not logo_src.exists():
        alt_logo = Path(__file__).resolve().parents[2] / "remotion" / "public" / "logo.png"
        if alt_logo.exists() and alt_logo != logo_src:
            shutil.copy(alt_logo, logo_src)

    # Force brand outro asset for every video
    outro_dst = remotion_public_dir / "visuals" / "trimmed_with_fade.mp4"
    outro_src = (
        Path(__file__).resolve().parents[2]
        / "predefined-components"
        / "git-test-remo-1"
        / "src"
        / "outro.mp4"
    )
    if not outro_src.exists():
        raise FileNotFoundError(f"Required outro asset not found: {outro_src}")
    outro_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(outro_src, outro_dst)

    # Get video duration using ffprobe (from input_dst — already converted)
    result = subprocess.run(
        [
            FFPROBE, "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json", str(input_dst),
        ],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")

    duration = float(json.loads(result.stdout)["format"]["duration"])

    # Get video dimensions and fps from the output file
    stream_result = subprocess.run(
        [
            FFPROBE, "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,r_frame_rate",
            "-of", "json", str(input_dst),
        ],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30,
    )
    if stream_result.returncode != 0:
        width = 1920
        height = 1080
        fps = 30
    else:
        stream_info = json.loads(stream_result.stdout)["streams"][0]
        width = stream_info.get("width", 1920)
        height = stream_info.get("height", 1080)
        r_frame_rate = stream_info.get("r_frame_rate", "30/1")
        num, den = r_frame_rate.split("/")
        fps = round(int(num) / int(den))

    is_reel = height > width
    logo_size = 140 if is_reel else 80

    # Compute zoom events from highlight_keywords x transcript words
    highlight_keywords: list[str] = analysis.get("highlight_keywords", [])
    keywords_lower = {kw.lower().strip() for kw in highlight_keywords}
    all_words: list[dict] = transcript.get("words", [])

    MAX_ZOOMS = 3
    ZOOM_DURATION_MS = 1400
    ZOOM_SCALE = 1.15

    candidates: list[int] = []
    last_hit_ms: float = -9999
    MIN_GAP_MS = 2000
    for w in all_words:
        word_clean = w.get("word", "").lower().strip().rstrip(".,:;!?")
        if word_clean in keywords_lower:
            ts_ms = int(float(w["start"]) * 1000)
            if ts_ms - last_hit_ms >= MIN_GAP_MS:
                candidates.append(ts_ms)
                last_hit_ms = ts_ms

    zoom_events: list[dict] = []
    if candidates:
        video_duration_ms = int(duration * 1000)
        bucket_size = max(1, video_duration_ms // MAX_ZOOMS)
        selected: list[int] = []
        for b in range(MAX_ZOOMS):
            bucket_start = b * bucket_size
            bucket_end   = (b + 1) * bucket_size
            for ts in candidates:
                if bucket_start <= ts < bucket_end:
                    selected.append(ts)
                    break

        for ts_ms in selected:
            zoom_events.append({
                "timestamp_ms": ts_ms,
                "duration_ms": ZOOM_DURATION_MS,
                "scale": ZOOM_SCALE,
            })

    print(f"    ✔ {len(zoom_events)}/{MAX_ZOOMS} speaker zoom events "
          f"({len(candidates)} candidates from {len(keywords_lower)} keywords)")

    # Build remotion_data.json
    remotion_data = {
        "video": {
            "src": f"visuals/{input_dst.name}",
            "duration_seconds": round(duration, 2),
            "fps": fps,
            "width": width,
            "height": height,
            "video_filter": os.getenv("VIDEO_FILTER", "brightness(1.15) contrast(1.2)"),
        },
        "words": transcript["words"],
        "scenes": analysis.get("scenes", []),
        "stat_overlays": analysis.get("stat_overlays", []),
        "captions_src": "captions.json",
        "highlight_keywords": analysis.get("highlight_keywords", []),
        "outro": {
            "type": "video",
            "duration_seconds": OUTRO_DURATION_SECONDS,
        },
        "broll_overlays": [],
        "pip_events":
            [_ensure_pip_format(ev) for ev in fetch_brolls(
                analysis.get("pip_events", []),
                remotion_public_dir,
                os.getenv("PEXELS_API_KEY", ""),
                gemini_client=gemini_client,
            )],
        "zoom_events": zoom_events,
        "brand": {
            "logo_src": "logo.png",
            "show_logo_watermark": True,
            "logo_position": "top-left",
            "logo_size": logo_size,
        },
        "suggested_cuts": analysis.get("suggested_cuts", []),
        "suggested_caption": analysis.get("suggested_caption", ""),
        "hashtags": analysis.get("hashtags", ""),
        "suggested_title": analysis.get("suggested_title", ""),
        "overall_mood": analysis.get("overall_mood", "calm"),
        "capitalize_words": analysis.get("capitalize_words", []),
    }

    json_path = remotion_public_dir / "remotion_data.json"
    with open(json_path, "w") as f:
        json.dump(remotion_data, f, indent=2)

    # Clean up old versioned inputs only after remotion_data.json is safely
    # pointing at the new file (never delete a file the data still references).
    for old in visuals_dir.glob("input_*.mp4"):
        if old == input_dst:
            continue
        _safe_unlink(old)

    print(f"    ✔ remotion_data.json written")
    return json_path
