import asyncio
import json
import os
import queue
import sys
import threading
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent / ".env")
import web_runner
from web_runner import run_pipeline, fetch_and_finalize, OUTPUT_DIR


PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

pipeline_state = {
    "status": "idle",
    "log_queue": queue.Queue(),
    "pip_events": None,
    "transcript": None,
    "analysis": None,
}

# Guards finalize so concurrent auto-approve/reconnect calls can't spawn
# overlapping threads whose cleanup steps delete each other's input files.
_finalize_lock = threading.Lock()

app = FastAPI(title="FitMantra Pipeline Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

INPUT_DIR = Path("input")
INPUT_DIR.mkdir(exist_ok=True)


@app.get("/api/stream")
async def stream_logs(request: Request):
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            try:
                data = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: pipeline_state["log_queue"].get(timeout=0.5))
                try:
                    serialized = json.dumps(data)
                except Exception as e:
                    serialized = json.dumps({"step": -1, "status": "error", "message": f"JSON serialize failed: {e}"})
                yield {"event": "log", "data": serialized}
                if data.get("status") in ("complete", "error", "waiting_for_approval"):
                    pipeline_state["status"] = data["status"]
                    if data["status"] == "waiting_for_approval":
                        yield {"event": "awaiting_broll", "data": serialized}
                    break
            except queue.Empty:
                yield {"event": "ping", "data": ""}
                continue
    return EventSourceResponse(event_generator())


@app.get("/api/status")
def get_status():
    inputs = sorted(INPUT_DIR.glob("*.mp4"))
    video_name = inputs[0].name if inputs else None
    qsize = pipeline_state["log_queue"].qsize()
    return {
        "status": pipeline_state["status"],
        "video": video_name,
        "queue_size": qsize,
    }


@app.post("/api/upload")
async def upload_file(request: Request):
    import aiofiles
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" not in content_type:
        raise HTTPException(400, "Use multipart/form-data with a 'file' field")
    form = await request.form()
    file = form.get("file")
    if not file:
        raise HTTPException(400, "No file in upload")
    data = await file.read()
    filename = file.filename

    # Remove old mp4s to keep only the new upload
    for old in INPUT_DIR.glob("*.mp4"):
        old.unlink()

    dest = INPUT_DIR / filename
    async with aiofiles.open(dest, "wb") as f:
        await f.write(data)
    pipeline_state["log_queue"].put({"step": 0, "substep": "", "status": "done", "message": f"Uploaded {filename} ({len(data)/1e6:.1f} MB)", "elapsed_sec": 0, "total_elapsed_sec": 0})
    return {"status": "uploaded", "filename": filename, "path": str(dest)}


@app.post("/api/start")
async def start_pipeline():
    if pipeline_state["status"] == "running":
        raise HTTPException(400, "Pipeline already running")
    if not PEXELS_API_KEY or not GEMINI_API_KEY:
        raise HTTPException(400, "API keys not configured. Add PEXELS_API_KEY and GEMINI_API_KEY to .env")
    
    video_inputs = sorted(INPUT_DIR.glob("*.mp4"))
    if not video_inputs:
        raise HTTPException(400, "No video found in input/ — upload an .mp4 file first")

    pipeline_state["pip_events"] = None
    pipeline_state["transcript"] = None
    pipeline_state["analysis"] = None
    pipeline_state["log_queue"] = queue.Queue()
    web_runner._sse_queue = pipeline_state["log_queue"]
    pipeline_state["status"] = "running"

    import threading as _threading
    import traceback

    def _run_thread():
        try:
            result = run_pipeline(PEXELS_API_KEY, GEMINI_API_KEY)
            if result["status"] == "awaiting_broll_approval":
                pipeline_state["pip_events"] = result["pip_events"]
                pipeline_state["transcript"] = result["transcript"]
                pipeline_state["analysis"] = result["analysis"]
                web_runner._yield(5, "waiting_for_approval", "Awaiting broll approval")
            elif result["status"] == "error":
                web_runner._yield(0, "error", result.get("message", "Unknown error"))
                pipeline_state["status"] = "idle"
        except Exception as e:
            web_runner._yield(0, "error", f"Pipeline crashed: {e}")
            pipeline_state["status"] = "idle"

    t = _threading.Thread(target=_run_thread, daemon=True)
    t.start()
    return {"status": "started"}


class BrollApproveRequest(BaseModel):
    approvals: list[dict]


@app.post("/api/brolls/approve")
async def approve_brolls(req: BrollApproveRequest):
    if pipeline_state["status"] not in ("waiting_for_approval", "running"):
        raise HTTPException(400, "Pipeline not awaiting broll approval")

    approvals = req.approvals
    pip_events = pipeline_state["pip_events"] or []
    
    for a in approvals:
        idx = a.get("index")
        action = a.get("action", "approve")
        if action == "manual" and a.get("url"):
            manual_url = a["url"]
            pexels_id = manual_url.split("/")[-1].split("?")[0] if "pexels" in manual_url else "manual"
            if idx < len(pip_events):
                pip_events[idx]["_manual_url"] = manual_url
        elif action == "retry":
            if idx < len(pip_events):
                pip_events[idx]["_retry"] = True
        elif action == "approve":
            if idx < len(pip_events):
                pip_events[idx]["_approved"] = True

    pipeline_state["log_queue"] = queue.Queue()
    web_runner._sse_queue = pipeline_state["log_queue"]

    if _finalize_lock.locked():
        return {"status": "finalizing"}

    def _finalize_thread():
        with _finalize_lock:
            try:
                result = fetch_and_finalize(
                    pip_events,
                    pipeline_state["transcript"],
                    pipeline_state["analysis"],
                    PEXELS_API_KEY, GEMINI_API_KEY,
                )
                if result["status"] == "error":
                    web_runner._yield(5, "error", result.get("message", "Finalize failed"))
                    pipeline_state["status"] = "idle"
                else:
                    pipeline_state["status"] = "complete"
            except Exception as e:
                web_runner._yield(5, "error", f"Finalize crashed: {e}")
                pipeline_state["status"] = "idle"

    t = threading.Thread(target=_finalize_thread, daemon=True)
    t.start()
    return {"status": "finalizing"}


@app.get("/api/brolls")
def get_broll_candidates():
    if not pipeline_state["pip_events"]:
        raise HTTPException(400, "No broll candidates available")
    return {"pip_events": pipeline_state["pip_events"]}


if __name__ == "__main__":
    import uvicorn
    os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
    print("Starting FitMantra Pipeline Server at http://localhost:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
