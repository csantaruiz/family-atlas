#!/usr/bin/env python3
"""Transcribe documentary narration with segment + word timestamps (no ffmpeg)."""

from __future__ import annotations

import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
import whisper
import whisper.audio


def load_wav_mono_16k(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as handle:
        channels = handle.getnchannels()
        sample_rate = handle.getframerate()
        frames = handle.readframes(handle.getnframes())

    audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)

    if sample_rate != 16000:
        duration = len(audio) / sample_rate
        target_len = max(1, int(duration * 16000))
        x_old = np.linspace(0.0, 1.0, num=len(audio), endpoint=False)
        x_new = np.linspace(0.0, 1.0, num=target_len, endpoint=False)
        audio = np.interp(x_new, x_old, audio).astype(np.float32)

    return audio.astype(np.float32)


def patch_whisper_audio_loader(wav_path: Path) -> None:
    def load_audio(_file: str, sr: int = whisper.audio.SAMPLE_RATE) -> np.ndarray:
        del _file, sr
        return load_wav_mono_16k(wav_path)

    whisper.audio.load_audio = load_audio


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    mp3 = root / "public/documentary/santa-ruiz-story.mp3"
    wav = root / "public/documentary/santa-ruiz-story.wav"
    out_dir = root / "public/documentary/transcript"
    out_dir.mkdir(parents=True, exist_ok=True)

    if not wav.exists():
        subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", "LEI16", str(mp3), str(wav)],
            check=True,
        )

    model_name = sys.argv[1] if len(sys.argv) > 1 else "tiny"
    patch_whisper_audio_loader(wav)
    model = whisper.load_model(model_name)

    result = model.transcribe(
        str(wav),
        language="en",
        word_timestamps=True,
        fp16=False,
        verbose=False,
        condition_on_previous_text=True,
    )

    json_path = out_dir / "santa-ruiz-story.json"
    json_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    last_end = result.get("segments", [{}])[-1].get("end", 0)
    print(f"Wrote {json_path}")
    print(f"Segments: {len(result.get('segments', []))}")
    print(f"Duration ~ {last_end:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
