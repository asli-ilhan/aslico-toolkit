"""
Local XTTS v2 voice-clone TTS server for Self Therapy.

POST /jobs   → { id }          start async synthesis
GET  /jobs/{id} → progress     { status, progress, error? }
GET  /jobs/{id}/audio → wav    when status=done
POST /speak  → wav             sync (short texts / CLI)

GET  /health
"""

from __future__ import annotations

import io
import os
import threading
import uuid
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
REFS = ROOT / "data" / "refs"
OUT = ROOT / "out"
OUT.mkdir(parents=True, exist_ok=True)

os.environ.setdefault("COQUI_TOS_AGREED", "1")

DEFAULT_REF = os.environ.get("LOCAL_VOICE_REF", "ref_1.wav")
HOST = os.environ.get("LOCAL_TTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("LOCAL_TTS_PORT", "8765"))
MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"
# XTTS blows up on long GPT sequences — keep chunks short
CHUNK_CHARS = int(os.environ.get("LOCAL_TTS_CHUNK_CHARS", "120"))

app = FastAPI(title="asliCo local voice TTS", version="0.2.0")
app.add_middleware(
  CORSMiddleware,
  allow_origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

_tts = None
_tts_lock = threading.Lock()
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


def get_tts():
  global _tts
  if _tts is None:
    import torch
    from TTS.api import TTS

    print(f"Loading {MODEL_NAME} … (first run downloads weights)")
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


def resolve_ref(ref: str | None) -> Path:
  ref_name = (ref or DEFAULT_REF).strip()
  if "/" in ref_name or "\\" in ref_name or ".." in ref_name:
    raise HTTPException(400, "Invalid ref")
  ref_path = REFS / ref_name
  if not ref_path.is_file():
    raise HTTPException(404, f"Reference not found: {ref_name}")
  return ref_path


def synthesize_chunks(
  text: str,
  language: str,
  ref_path: Path,
  on_progress=None,
) -> bytes:
  tts = get_tts()
  chunks = split_text(text, max_chars=CHUNK_CHARS)
  pieces: list[np.ndarray] = []
  sr = 24000
  total = max(len(chunks), 1)

  for i, chunk in enumerate(chunks):
    if on_progress:
      on_progress(i / total)
    print(f"[{i + 1}/{total}] synthesizing {len(chunk)} chars…")
    arr = synth_one(tts, chunk, language, ref_path)
    pieces.append(arr)
    pieces.append(np.zeros(int(sr * 0.2), dtype=np.float32))

  if on_progress:
    on_progress(1.0)

  audio = np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)
  buf = io.BytesIO()
  sf.write(buf, audio, sr, format="WAV")
  return buf.getvalue()


def synth_one(tts, chunk: str, language: str, ref_path: Path) -> np.ndarray:
  """Synthesize one chunk; on XTTS index errors, split smaller and retry."""
  try:
    with _tts_lock:
      wav = tts.tts(text=chunk, speaker_wav=str(ref_path), language=language)
    return np.asarray(wav, dtype=np.float32)
  except IndexError:
    if len(chunk) < 40:
      print(f"skip failed micro-chunk ({len(chunk)} chars)")
      return np.zeros(int(24000 * 0.15), dtype=np.float32)
    mid = len(chunk) // 2
    # prefer split on space near middle
    cut = chunk.rfind(" ", 0, mid)
    if cut < mid * 0.4:
      cut = mid
    left = chunk[:cut].strip()
    right = chunk[cut:].strip()
    print(f"retry split → {len(left)}+{len(right)} chars")
    parts = []
    if left:
      parts.append(synth_one(tts, left, language, ref_path))
    if right:
      parts.append(synth_one(tts, right, language, ref_path))
    return np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)


def split_text(text: str, max_chars: int) -> list[str]:
  text = " ".join(text.split())
  if len(text) <= max_chars:
    return [text]
  parts: list[str] = []
  remaining = text
  while len(remaining) > max_chars:
    cut = remaining.rfind(". ", 0, max_chars)
    if cut < max_chars * 0.35:
      cut = remaining.rfind(" ", 0, max_chars)
    if cut < 1:
      cut = max_chars
    parts.append(remaining[: cut + 1].strip())
    remaining = remaining[cut + 1 :].strip()
  if remaining:
    parts.append(remaining)
  return [p for p in parts if p]


def run_job(job_id: str, text: str, language: str, ref_path: Path) -> None:
  def on_progress(p: float) -> None:
    with _jobs_lock:
      job = _jobs.get(job_id)
      if job:
        job["progress"] = round(min(max(p, 0.0), 0.99) * 100)

  try:
    wav = synthesize_chunks(text, language, ref_path, on_progress=on_progress)
    path = OUT / f"{job_id}.wav"
    path.write_bytes(wav)
    with _jobs_lock:
      job = _jobs.get(job_id)
      if job:
        job["status"] = "done"
        job["progress"] = 100
        job["path"] = str(path)
  except Exception as exc:  # noqa: BLE001
    print(f"job {job_id} failed: {exc}")
    with _jobs_lock:
      job = _jobs.get(job_id)
      if job:
        job["status"] = "error"
        job["error"] = str(exc)[:400]


@app.get("/health")
def health():
  refs = sorted(p.name for p in REFS.glob("*.wav")) if REFS.exists() else []
  return {
    "ok": True,
    "model": MODEL_NAME,
    "refs": refs,
    "default_ref": DEFAULT_REF,
    "chunk_chars": CHUNK_CHARS,
  }


@app.post("/jobs")
def create_job(body: SpeakRequest):
  text = body.text.strip()
  if not text:
    raise HTTPException(400, "Empty text")
  ref_path = resolve_ref(body.ref)
  job_id = uuid.uuid4().hex[:12]
  with _jobs_lock:
    _jobs[job_id] = {
      "status": "running",
      "progress": 0,
      "error": None,
      "path": None,
    }
  thread = threading.Thread(
    target=run_job,
    args=(job_id, text, body.language, ref_path),
    daemon=True,
  )
  thread.start()
  return {"id": job_id}


@app.get("/jobs/{job_id}")
def job_status(job_id: str):
  with _jobs_lock:
    job = _jobs.get(job_id)
  if not job:
    raise HTTPException(404, "Job not found")
  return {
    "id": job_id,
    "status": job["status"],
    "progress": job["progress"],
    "error": job["error"],
  }


@app.get("/jobs/{job_id}/audio")
def job_audio(job_id: str):
  with _jobs_lock:
    job = _jobs.get(job_id)
  if not job:
    raise HTTPException(404, "Job not found")
  if job["status"] != "done" or not job.get("path"):
    raise HTTPException(409, "Audio not ready")
  data = Path(job["path"]).read_bytes()
  return Response(content=data, media_type="audio/wav")


@app.post("/speak")
def speak(body: SpeakRequest):
  text = body.text.strip()
  if not text:
    raise HTTPException(400, "Empty text")
  ref_path = resolve_ref(body.ref)
  try:
    wav = synthesize_chunks(text, body.language, ref_path)
  except Exception as exc:  # noqa: BLE001
    raise HTTPException(500, str(exc)[:400]) from exc
  return Response(content=wav, media_type="audio/wav")


if __name__ == "__main__":
  import uvicorn

  get_tts()
  uvicorn.run(app, host=HOST, port=PORT, log_level="info")
