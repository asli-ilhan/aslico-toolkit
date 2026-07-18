"""
Local XTTS v2 voice-clone TTS server for Self Therapy.

Usage:
  cd tools/local-voice
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  ./prepare_samples.sh   # if refs missing
  python server.py       # http://127.0.0.1:8765

POST /speak  JSON { "text": "...", "language": "tr", "ref": "ref_1.wav" }
→ audio/wav

GET /health
"""

from __future__ import annotations

import io
import os
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
REFS = ROOT / "data" / "refs"
OUT = ROOT / "out"
OUT.mkdir(parents=True, exist_ok=True)

# Non-interactive Coqui license prompt (personal / local use — see https://coqui.ai/cpml)
os.environ.setdefault("COQUI_TOS_AGREED", "1")

DEFAULT_REF = os.environ.get("LOCAL_VOICE_REF", "ref_1.wav")
HOST = os.environ.get("LOCAL_TTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("LOCAL_TTS_PORT", "8765"))
MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"

app = FastAPI(title="asliCo local voice TTS", version="0.1.0")
_tts = None


def get_tts():
  global _tts
  if _tts is None:
    # Lazy import — torch/TTS are heavy
    import torch
    from TTS.api import TTS

    print(f"Loading {MODEL_NAME} … (first run downloads weights)")
    # XTTS is most reliable on CUDA. On Apple Silicon use CPU unless forced.
    env_gpu = os.environ.get("LOCAL_TTS_GPU")
    if env_gpu is not None:
      use_gpu = env_gpu != "0"
    else:
      use_gpu = torch.cuda.is_available()
    print(f"device: {'cuda' if use_gpu else 'cpu'}")
    _tts = TTS(MODEL_NAME, gpu=use_gpu)
    print("Model ready.")
  return _tts


class SpeakRequest(BaseModel):
  text: str = Field(..., min_length=1)
  language: str = "tr"
  ref: str | None = None
  # XTTS speed-ish control via temperature / length_penalty if exposed later


@app.get("/health")
def health():
  refs = sorted(p.name for p in REFS.glob("*.wav")) if REFS.exists() else []
  return {
    "ok": True,
    "model": MODEL_NAME,
    "refs": refs,
    "default_ref": DEFAULT_REF,
  }


@app.post("/speak")
def speak(body: SpeakRequest):
  text = body.text.strip()
  if not text:
    raise HTTPException(400, "Empty text")

  ref_name = (body.ref or DEFAULT_REF).strip()
  # Prevent path traversal
  if "/" in ref_name or "\\" in ref_name or ".." in ref_name:
    raise HTTPException(400, "Invalid ref")
  ref_path = REFS / ref_name
  if not ref_path.is_file():
    raise HTTPException(404, f"Reference not found: {ref_name}")

  tts = get_tts()
  # Chunk long scripts — XTTS quality drops on huge single passes
  chunks = split_text(text, max_chars=220)
  pieces: list[np.ndarray] = []
  sr = 24000

  for i, chunk in enumerate(chunks):
    print(f"[{i + 1}/{len(chunks)}] synthesizing {len(chunk)} chars…")
    wav = tts.tts(
      text=chunk,
      speaker_wav=str(ref_path),
      language=body.language,
    )
    arr = np.asarray(wav, dtype=np.float32)
    pieces.append(arr)
    # short silence between chunks
    pieces.append(np.zeros(int(sr * 0.25), dtype=np.float32))

  audio = np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)
  buf = io.BytesIO()
  sf.write(buf, audio, sr, format="WAV")
  return Response(content=buf.getvalue(), media_type="audio/wav")


def split_text(text: str, max_chars: int) -> list[str]:
  text = " ".join(text.split())
  if len(text) <= max_chars:
    return [text]
  parts: list[str] = []
  remaining = text
  while len(remaining) > max_chars:
    cut = remaining.rfind(". ", 0, max_chars)
    if cut < max_chars * 0.4:
      cut = remaining.rfind(" ", 0, max_chars)
    if cut < 1:
      cut = max_chars
    parts.append(remaining[: cut + 1].strip())
    remaining = remaining[cut + 1 :].strip()
  if remaining:
    parts.append(remaining)
  return [p for p in parts if p]


if __name__ == "__main__":
  import uvicorn

  # Warm model on boot so first /speak is faster
  get_tts()
  uvicorn.run(app, host=HOST, port=PORT, log_level="info")
