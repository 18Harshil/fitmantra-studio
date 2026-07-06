import json
import os
import queue
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from steps.extract_audio import extract_audio
from steps.transcribe import transcribe
from steps.analyse import analyse
from steps.clean_video import clean_video
from steps.prepare_remotion import prepare_remotion


FPS = 30
FFPROBE = "ffprobe"
OUTPUT_DIR = Path("output")
REMOTION_PUBLIC = Path("../remotion/public")
_errors = []
_progress_callback = None
_sse_queue = None
_heartbeat_stop = threading.Event()
_heartbeat_stop.set()  # initially stopped
_heartbeat_step = -1
_heartbeat_start = 0


def _heartbeat_loop(step_label: str):
    """Periodically yield a running event so the UI shows live activity."""
    while not _heartbeat_stop.is_set():
        _heartbeat_stop.wait(timeout=3)
        if _heartbeat_stop.is_set() or _heartbeat_start == 0:
            break
        secs = int(time.time() - _heartbeat_start)
        _yield(_heartbeat_step, "running", f"Working... ({secs}s)",
               step_label, float(secs), float(secs))


def _yield(step: int, status: str, message: str, substep: str = "",
           elapsed: float = 0, total: float = 0):
    try:
        payload = {
            "step": step, "substep": substep, "status": status,
            "message": str(message), "elapsed_sec": round(float(elapsed), 1),
            "total_elapsed_sec": round(float(total), 1),
        }
        print(json.dumps(payload), flush=True)
        if _progress_callback:
            _progress_callback(payload)
        if _sse_queue is not None:
            _sse_queue.put(payload)
    except Exception as e:
        print(json.dumps({"step": -1, "status": "error", "message": f"_yield crashed: {e}"}), flush=True)


def _find_video():
    _inputs = sorted(Path("input").glob("*.mp4"))
    return _inputs[0] if _inputs else Path("input/PLACE_VIDEO_HERE.mp4")


def _count_frames(video_path: Path) -> int:
    r = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=nb_read_frames",
         "-of", "csv=p=0", str(video_path)],
        capture_output=True, text=True, timeout=30)
    return int(r.stdout.strip()) if r.stdout.strip() else 0


def run_pipeline(pexels_api_key: str, gemini_api_key: str):
    global _errors
    _errors = []
    _heartbeat_stop.set()
    _heartbeat_step = -1
    _heartbeat_start = 0
    start_time = time.time()
    input_video = _find_video()

    def elapsed():
        return time.time() - start_time

    if not input_video.exists():
        _yield(0, "error", f"Video not found: {input_video}", total=elapsed())
        return {"status": "error", "message": f"Video not found: {input_video}"}

    dur = _get_duration(input_video)
    if dur > 600:
        _yield(0, "error", f"Video too long: {dur:.0f}s", total=elapsed())
        return {"status": "error", "message": f"Video too long"}

    _yield(0, "done", f"Input: {input_video.name}, {dur:.0f}s", elapsed=elapsed(), total=elapsed())

    # Step 1 - Extract audio
    _yield(1, "running", "Extracting audio from video...", substep="extract_audio", elapsed=elapsed(), total=elapsed())
    t0 = time.time()
    try:
        audio_path = extract_audio(input_video, OUTPUT_DIR)
        _yield(1, "done", f"Audio extracted -> {audio_path.name}", substep="extract_audio",
               elapsed=time.time() - t0, total=elapsed())
    except Exception as e:
        _yield(1, "error", f"Extract failed: {e}", total=elapsed())
        return {"status": "error", "message": str(e)}

    # Step 2 - Transcribe
    _yield(2, "running", "Loading Whisper model...", substep="model_load", elapsed=elapsed(), total=elapsed())
    from google import genai
    client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None

    t0 = time.time()
    try:
        _yield(2, "running", "Transcribing audio (medium model)...", substep="transcribing", elapsed=elapsed(), total=elapsed())
        _heartbeat_stop.clear()
        _heartbeat_step = 2
        _heartbeat_start = time.time()
        t_beat = threading.Thread(target=_heartbeat_loop, args=("transcribing",), daemon=True)
        t_beat.start()
        transcript = transcribe(audio_path, OUTPUT_DIR, client, progress_callback=_yield)
        _heartbeat_stop.set()
        n_words = len(transcript.get("words", []))
        _yield(2, "done", f"{n_words} words transcribed", substep="transcribing",
               elapsed=time.time() - t0, total=elapsed())
    except Exception as e:
        _heartbeat_stop.set()
        _yield(2, "error", f"Transcribe failed: {e}", total=elapsed())
        return {"status": "error", "message": str(e)}

    # Step 3 - Analyse with Gemini
    _yield(3, "running", "Sending to Gemini 2.5 Flash for analysis...", substep="gemini_analyse", elapsed=elapsed(), total=elapsed())
    t0 = time.time()
    try:
        _heartbeat_stop.clear()
        _heartbeat_step = 3
        _heartbeat_start = time.time()
        t_beat = threading.Thread(target=_heartbeat_loop, args=("gemini_analyse",), daemon=True)
        t_beat.start()
        analysis = analyse(transcript, OUTPUT_DIR, client, progress_callback=_yield)
        _heartbeat_stop.set()
        n_pips = len(analysis.get("pip_events", []))
        n_cuts = len(analysis.get("suggested_cuts", []))
        _yield(3, "done", f"{n_pips} pip events, {n_cuts} suggested cuts found", substep="gemini_analyse",
               elapsed=time.time() - t0, total=elapsed())
    except Exception as e:
        _heartbeat_stop.set()
        _yield(3, "error", f"Analysis failed: {e}", total=elapsed())
        return {"status": "error", "message": str(e)}

    # Step 4 - Clean video
    _yield(4, "running", "Computing keep segments from suggested cuts...", substep="compute_segments", elapsed=elapsed(), total=elapsed())
    t0 = time.time()
    try:
        _heartbeat_stop.clear()
        _heartbeat_step = 4
        _heartbeat_start = time.time()
        t_beat = threading.Thread(target=_heartbeat_loop, args=("clean",), daemon=True)
        t_beat.start()
        video_path, transcript, analysis = clean_video(
            video_path=input_video, transcript=transcript, analysis=analysis,
            output_dir=OUTPUT_DIR, progress_callback=_yield)
        _heartbeat_stop.set()
        n_segments = len(analysis.get("suggested_cuts", []))
        _yield(4, "done", f"Cleaned video ready ({n_segments} segments removed)", substep="clean",
               elapsed=time.time() - t0, total=elapsed())
    except Exception as e:
        _heartbeat_stop.set()
        _yield(4, "error", f"Clean failed: {e}", total=elapsed())
        return {"status": "error", "message": str(e)}

    # Yield broll candidates first (before waiting_for_approval, so SSE handler reads it)
    pip_events = analysis.get("pip_events", [])
    _yield(5, "broll_candidates", json.dumps([
        {"index": i, "timestamp": ev["timestamp"], "duration": ev.get("duration", 4),
         "pip_format": ev.get("pip_format", "pip"), "search_query": ev.get("search_query", ""),
         "query": ev.get("search_query", "")}
        for i, ev in enumerate(pip_events)
    ]), substep="broll_review", elapsed=elapsed(), total=elapsed())
    _yield(5, "waiting_for_approval", "B-roll clips ready for review",
           substep="broll_review", elapsed=elapsed(), total=elapsed())

    return {"status": "awaiting_broll_approval", "pip_events": pip_events, "transcript": transcript, "analysis": analysis}


def fetch_and_finalize(pip_events: list, transcript: dict, analysis: dict,
                       pexels_api_key: str, gemini_api_key: str):
    global _errors
    start_time = time.time()

    def elapsed():
        return time.time() - start_time

    from google import genai
    client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None

    _yield(5, "running", "Downloading approved B-rolls from Pexels...", substep="fetch_brolls", elapsed=elapsed(), total=elapsed())
    t0 = time.time()
    try:
        import os
        os.environ["PEXELS_API_KEY"] = pexels_api_key
        remotion_json = prepare_remotion(
            transcript=transcript, analysis=analysis,
            video_path=OUTPUT_DIR / "cleaned.mp4",
            pipeline_output_dir=OUTPUT_DIR,
            remotion_public_dir=REMOTION_PUBLIC,
            gemini_client=client,
        )
        _yield(5, "done", "Remotion data written", substep="broll_fetch",
               elapsed=time.time() - t0, total=elapsed())
        _yield(5, "done", "Pipeline complete! Launching studio...", elapsed=elapsed(), total=elapsed())
        return {"status": "complete", "studio_url": "http://localhost:3000"}
    except Exception as e:
        _yield(5, "error", f"Finalize failed: {e}", total=elapsed())
        return {"status": "error", "message": str(e)}


def _get_duration(video_path: Path) -> float:
    r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(video_path)], capture_output=True, text=True, timeout=30)
    return float(r.stdout.strip())
