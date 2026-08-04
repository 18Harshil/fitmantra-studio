"""
Remove dead space, pauses, and retakes from video.
Uses ffmpeg select/aselect to concatenate keep segments.
CUT_PAD leaves natural breathing room at cut boundaries.
Produces a cleaned video and remaps all timestamps in transcript + analysis.
"""

import json
import subprocess
from pathlib import Path

FFMPEG = "ffmpeg"
CUT_PAD = 0.08


BOUNDARY_EPS = 0.003


def _snap_to_word_boundaries(cuts: list[tuple[float, float]], words: list[dict]) -> list[tuple[float, float]]:
    """Expand cut boundaries to cover complete words they straddle.
    Adds epsilon buffer so boundary doesn't land exactly on word edge.
    """
    snapped = []
    for s, e in cuts:
        for w in words:
            ws, we = w["start"], w["end"]
            if ws < s < we:
                s = ws + BOUNDARY_EPS
            if ws < e < we:
                e = we - BOUNDARY_EPS
        snapped.append((s, e))
    return snapped


def _compute_keep_segments(transcript: dict, analysis: dict) -> list[tuple[float, float]]:
    """Determine which time ranges to keep (cuts + dead space removed)."""
    words = transcript.get("words", [])
    if not words:
        return [(0.0, analysis.get("duration_seconds", 30))]

    start_pad = 0.3
    end_pad = 0.3
    first = max(0.0, words[0]["start"] - start_pad)
    last = words[-1]["end"] + end_pad

    cuts = []
    for c in analysis.get("suggested_cuts", []):
        s = c["start"] + CUT_PAD
        e = c["end"] - CUT_PAD
        if s < last and e > first:
            cut_start = max(first, s)
            cut_end = min(last, e)
            if cut_end - cut_start > 0.1:
                cuts.append((cut_start, cut_end))

    # Snap to word boundaries to avoid partial-word artifacts
    cuts = _snap_to_word_boundaries(cuts, words)

    cuts.sort()
    merged = []
    for c in cuts:
        if merged and c[0] <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], c[1]))
        else:
            merged.append(c)

    keep = []
    cursor = first
    for cs, ce in merged:
        if cs > cursor:
            keep.append((cursor, cs))
        cursor = max(cursor, ce)
    if last > cursor:
        keep.append((cursor, last))

    if not keep:
        keep = [(first, last)]

    return keep


def _build_select_expr(keep_segments: list[tuple[float, float]]) -> str:
    """Build ffmpeg select filter expression: between(t,0,2)+between(t,5,10)."""
    parts = [f"between(t,{s:.3f},{e:.3f})" for s, e in keep_segments]
    return "+".join(parts)


def _remap_timestamps(data: dict, keep_segments: list[tuple[float, float]]) -> dict:
    """Remap all time fields after removing dead space + cuts.

    keep_segments are the original-time spans kept.
    Items whose primary timestamp falls in a removed gap are filtered out.
    suggested_cuts spanning a gap get pinned to the gap position (zero duration).
    """
    import copy
    data = copy.deepcopy(data)
    initial_offset = keep_segments[0][0]
    last_keep_end = keep_segments[-1][1]

    def _remap(t: float, clamp_to_gap: bool = False) -> float | None:
        """Map original t to cleaned timeline.
        `removed` tracks only the dead space + gaps cut out before t.
        """
        if t < initial_offset:
            return None
        removed = initial_offset
        prev_end = initial_offset
        for ks, ke in keep_segments:
            gap = ks - prev_end  # removed segment before this keep
            removed += gap
            if ks <= t < ke:
                return t - removed
            if t < ks:
                if clamp_to_gap:
                    return ks - removed
                return None
            prev_end = ke
        # t is after the last keep segment
        if t >= last_keep_end and clamp_to_gap:
            return last_keep_end - (removed + (last_keep_end - prev_end))
        return None

    # Process transcript words and other items — filter if in gap
    for key, fields in [
        ("words", ["start", "end"]),
        ("scenes", ["start", "end"]),
        ("stat_overlays", ["timestamp"]),
        ("pip_events", ["timestamp"]),
    ]:
        new_items = []
        for item in data.get(key, []):
            ok = True
            for f in fields:
                if f in item:
                    new_t = _remap(item[f], clamp_to_gap=False)
                    if new_t is None:
                        ok = False
                        break
                    item[f] = new_t
            if ok:
                new_items.append(item)
        data[key] = new_items

    # Process suggested_cuts — pin to gap position but don't filter
    new_cuts = []
    for c in data.get("suggested_cuts", []):
        new_start = _remap(c["start"], clamp_to_gap=True)
        new_end = _remap(c["end"], clamp_to_gap=True)
        if new_start is not None and new_end is not None:
            c["start"] = min(new_start, new_end)
            c["end"] = max(new_start, new_end)
            new_cuts.append(c)
    data["suggested_cuts"] = new_cuts

    return data


def clean_video(
    video_path: Path,
    transcript: dict,
    analysis: dict,
    output_dir: Path,
    progress_callback=None,
) -> tuple[Path, dict, dict]:
    """Remove dead space + suggested cuts using select filter.

    Returns (cleaned_video_path, new_transcript, new_analysis).
    """
    keep = _compute_keep_segments(transcript, analysis)
    total_keep = sum(e - s for s, e in keep)
    total_removed = sum(keep[i][0] - keep[i-1][1] for i in range(1, len(keep))) + keep[0][0]

    print(f"    ── Cleaning video ──")
    print(f"      Keep segments: {len(keep)}")
    for s, e in keep:
        print(f"        {s:.1f}s → {e:.1f}s ({e-s:.1f}s)")
    print(f"      Removed: {total_removed:.1f}s (dead space + cuts)")
    print(f"      New duration: ~{total_keep:.1f}s")

    expr = _build_select_expr(keep)
    output_path = output_dir / "cleaned.mp4"

    # Prefer GPU encoding when available (4K/60fps input is too slow on CPU)
    _probe = subprocess.run(
        [FFMPEG, "-hide_banner", "-encoders"], capture_output=True, text=True, timeout=30
    )
    video_encoder = "libx264"
    encoder_args = ["-preset", "ultrafast", "-crf", "23"]
    if "h264_nvenc" in _probe.stdout:
        video_encoder = "h264_nvenc"
        encoder_args = ["-preset", "p4", "-cq", "23"]

    cmd = [
        FFMPEG, "-y", "-i", str(video_path),
        "-vf", f"select='{expr}',setpts=N/FRAME_RATE/TB",
        "-af", f"aselect='{expr}',asetpts=N/SR/TB",
        "-vsync", "cfr", "-pix_fmt", "yuv420p", "-c:v", video_encoder, *encoder_args,
        "-c:a", "aac", "-b:a", "128k",
        str(output_path),
    ]
    print(f"      Running ffmpeg ({video_encoder})...")
    r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1200)
    if r.returncode != 0:
        r2 = subprocess.run(cmd, capture_output=True, text=True, timeout=1200)
        print(f"      ✗ ffmpeg error: {r2.stderr[:600]}")
        return (video_path, transcript, analysis)

    print(f"      ✔ Cleaned video → {output_path.name}")

    new_transcript = _remap_timestamps(transcript, keep)
    new_analysis = _remap_timestamps(analysis, keep)

    return (output_path, new_transcript, new_analysis)
