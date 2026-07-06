"""
Fetch B-roll video clips from Pexels API for pip_events.
For each pip_event with a search_query, download a matching stock video,
trim it to the event duration, and save to remotion visuals directory.
Uses Gemini to pick the best match for query relevance + FitMantra brand fit.
"""

import os
import subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

PEXELS_SEARCH_URL = "https://api.pexels.com/videos/search"
MAX_WORKERS = 4
FFMPEG = "ffmpeg"
PIP_TRANSITION_PAD = 12 / 30  # 6 frames in + 6 frames out at 30fps


def _search_pexels_multi(query: str, api_key: str) -> list[dict]:
    headers = {"Authorization": api_key}
    params = {"query": query, "per_page": 5, "orientation": "portrait", "size": "medium"}
    try:
        resp = requests.get(PEXELS_SEARCH_URL, headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json().get("videos", [])[:3]
    except Exception as e:
        print(f"      ✗ Pexels search '{query}' failed: {e}")
        return []


def _gemini_pick_best(
    gemini_client,
    search_query: str,
    candidates: list[dict],
) -> dict | None:
    """Use Gemini to pick the best Pexels video for query relevance + FitMantra brand fit."""
    if not candidates:
        return None
    if not gemini_client:
        return candidates[0]
    lines = []
    for i, v in enumerate(candidates):
        tags = ", ".join(v.get("tags", []) or [])
        user = v.get("user", {}).get("name", "?")
        lines.append(f"  [{i}] id={v.get('id','?')} tags='{tags}' photographer={user}")
    prompt = (
        "You pick the best stock video for FitMantra (gut health, nutrition, wellness brand). "
        f"Search query: '{search_query}'\nCandidates:\n"
        + "\n".join(lines)
        + "\n\nReturn ONLY the index number (0, 1, or 2) of the best match."
    )
    try:
        resp = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        idx = int(resp.text.strip())
        return candidates[idx] if 0 <= idx < len(candidates) else candidates[0]
    except Exception:
        return candidates[0]


def _pick_url(video: dict) -> str | None:
    files = video.get("video_files", [])
    if not files:
        return None
    def key(f):
        q = f.get("quality", "sd")
        w = f.get("width", 0) or 0
        return (0 if q == "hd" else 1, -w)
    files.sort(key=key)
    return files[0].get("link")


def _download_trim(url: str, output: Path, duration: float) -> bool:
    try:
        # Add transition padding so broll doesn't freeze during fade-out
        total = duration + PIP_TRANSITION_PAD
        cmd = [FFMPEG, "-y", "-ss", "0", "-i", url, "-t", str(total),
               "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,"
                      "pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
               "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
               "-vsync", "cfr", "-an", str(output)]
        r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
        return r.returncode == 0
    except Exception as e:
        print(f"      ✗ Download failed: {e}")
        return False


def _fetch_one(index: int, search_query: str, output: Path, api_key: str,
               gemini_client=None, used_ids: set | None = None,
               manual_url: str | None = None) -> tuple[int, str | None]:
    if manual_url:
        print(f"      🔗 B-roll {index}: Using manual URL")
        return (index, manual_url)
    print(f"      🔍 B-roll {index}: Searching Pexels for '{search_query}'")
    candidates = _search_pexels_multi(search_query, api_key)
    if not candidates:
        simple = " ".join(search_query.split()[:2])
        print(f"      ↩ B-roll {index}: Retrying with '{simple}'")
        candidates = _search_pexels_multi(simple, api_key)
    if not candidates:
        print(f"      ✗ B-roll {index}: No results for '{search_query}'")
        return (index, None)

    # Exclude already-used Pexels IDs to avoid duplicate clips
    if used_ids:
        before = len(candidates)
        candidates = [c for c in candidates if c.get("id") not in used_ids]
        if candidates and len(candidates) < before:
            print(f"      ↪ B-roll {index}: Skipped {before - len(candidates)} already-used clip(s)")
        if not candidates:
            print(f"      ✗ B-roll {index}: All candidates already used elsewhere")
            return (index, None)

    picked = _gemini_pick_best(gemini_client, search_query, candidates)
    if not picked:
        return (index, None)
    url = _pick_url(picked)
    if not url:
        return (index, None)
    vid_id = picked.get("id", "?")
    if used_ids is not None:
        used_ids.add(vid_id)
    print(f"      ✔ B-roll {index}: '{search_query}' → Pexels #{vid_id}")
    return (index, url)


def fetch_brolls(
    pip_events: list[dict],
    output_dir: Path,
    pexels_api_key: str,
    gemini_client=None,
    duration_override: float | None = None,
) -> list[dict]:
    """Download Pexels clips for each pip_event with a search_query.

    Uses Gemini to pick the best matching clip when a client is provided.
    Each clip is trimmed to the event's duration, saved as broll_N.mp4.
    Returns updated pip_events with pip_source set to the file path.
    """
    visuals_dir = output_dir / "visuals"
    visuals_dir.mkdir(parents=True, exist_ok=True)

    to_fetch = [(i, ev) for i, ev in enumerate(pip_events) if ev.get("search_query")]
    if not to_fetch:
        for ev in pip_events:
            ev["pip_source"] = "black"
        return pip_events

    print(f"\n    🎬 Fetching {len(to_fetch)} B-roll clips from Pexels...")

    # Search Pexels sequentially to track used IDs and avoid duplicates
    used_ids: set[int] = set()
    urls: dict[int, str | None] = {}
    for i, ev in to_fetch:
        query = ev["search_query"]
        manual_url = ev.get("_manual_url")
        if ev.get("_retry"):
            query = query + " other"
            print(f"      ↩ B-roll {i}: Retry query → '{query}'")
        _, url = _fetch_one(i, query, visuals_dir / f"broll_{i}.mp4",
                            pexels_api_key, gemini_client, used_ids,
                            manual_url=manual_url)
        urls[i] = url

    # Download & trim sequentially (bandwidth bottleneck)
    success = 0
    for i, ev in to_fetch:
        out_path = visuals_dir / f"broll_{i}.mp4"
        if out_path.exists():
            print(f"      ✔ B-roll {i}: Using existing file (skip download)")
            ev["pip_source"] = f"visuals/broll_{i}.mp4"
            success += 1
            continue
        url = urls.get(i)
        if not url:
            ev["pip_source"] = "black"
            continue
        dur = duration_override or ev.get("duration", 4)
        if _download_trim(url, out_path, dur):
            ev["pip_source"] = f"visuals/broll_{i}.mp4"
            success += 1
        else:
            ev["pip_source"] = "black"

    print(f"    ✔ B-roll fetch complete: {success}/{len(to_fetch)} clips downloaded")
    return pip_events
