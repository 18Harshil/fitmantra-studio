"""
Transcribe audio using faster_whisper for word-level timestamps.
"""

import json
from pathlib import Path
from faster_whisper import WhisperModel


def transcribe(audio_path: Path, output_dir: Path, client=None,
               progress_callback=None) -> dict:
    """Transcribe audio using faster_whisper with word-level timestamps.

    Args:
        audio_path: Path to the audio MP3 file.
        output_dir: Directory to save the transcript JSON.
        client: Ignored (kept for compatibility with demo.py signature).
        progress_callback: Optional callable(step, status, message, substep, elapsed, total).

    Returns:
        Dict with 'words' (list of {word, start, end}) and 'full_text' (str).
    """
    import time as _time

    model_size = "base"
    
    model = WhisperModel(model_size, device="cpu", compute_type="default")

    if progress_callback:
        progress_callback(2, "running", "Model loaded, transcribing...", "transcribing", 0, 0)
    print(f"    Running faster_whisper ({model_size} model)...")
    t_start = _time.time()
    segments, info = model.transcribe(str(audio_path), word_timestamps=True)

    words = []
    seg_count = 0
    last_progress = _time.time()
    for segment in segments:
        seg_count += 1
        for word in segment.words:
            words.append({
                "word": word.word.strip(),
                "start": word.start,
                "end": word.end
            })
        now = _time.time()
        if progress_callback and now - last_progress >= 3.0:
            elapsed = now - t_start
            total_sec = getattr(info, 'duration', 0) or 0
            pct = min(word.end / total_sec * 100, 99) if total_sec > 0 else 0
            progress_callback(2, "running", f"Transcribing... {pct:.0f}% ({seg_count} segments)",
                             "transcribing", elapsed, _time.time() - t_start)
            last_progress = now

    # Fix common whisper spelling errors
    corrections = {
        "Ecomansia": "Akkermansia",
        "Ecomensia": "Akkermansia",
        "ecomansia": "Akkermansia",
        "ecomensia": "Akkermansia",
        "Ecomansia,": "Akkermansia,",
        "Ecomensia,": "Akkermansia,",
        "Ecomansia.": "Akkermansia.",
        "Ecomensia.": "Akkermansia.",
        "diets": "diet",
    }
    for w in words:
        raw = w["word"]
        if raw in corrections:
            w["word"] = corrections[raw]

    full_text = " ".join(w["word"] for w in words)

    # Save transcript
    transcript_path = output_dir / "transcript.json"
    with open(transcript_path, "w") as f:
        json.dump({"words": words, "full_text": full_text}, f, indent=2)

    print(f"    ✔ Transcribed {len(words)} words")
    print(f"    Preview: {full_text[:120]}...")
    return {"words": words, "full_text": full_text}
