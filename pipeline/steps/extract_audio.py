"""
Extract audio track from input video as MP3 using ffmpeg-full.
"""

import subprocess
from pathlib import Path

FFMPEG = "ffmpeg"


def extract_audio(video_path: Path, output_dir: Path) -> Path:
    """Extract audio from video file to MP3 format.

    Args:
        video_path: Path to the input video file.
        output_dir: Directory to write the audio file.

    Returns:
        Path to the extracted audio MP3 file.

    Raises:
        RuntimeError: If FFmpeg audio extraction fails.
    """
    output_path = output_dir / "audio.mp3"

    result = subprocess.run(
        [
            FFMPEG, "-i", str(video_path),
            "-q:a", "0", "-map", "a",
            str(output_path), "-y", "-loglevel", "error"
        ],
        capture_output=True
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg audio extraction failed: {result.stderr.decode()}"
        )

    print(f"    ✔ Audio extracted → {output_path}")
    return output_path
