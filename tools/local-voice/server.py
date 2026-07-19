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
# XTTS blows up on long GPT sequences — keep chunks moderate; crossfade joins them
CHUNK_CHARS = int(os.environ.get("LOCAL_TTS_CHUNK_CHARS", "160"))
CROSSFADE_MS = int(os.environ.get("LOCAL_TTS_CROSSFADE_MS", "110"))
EDGE_FADE_MS = int(os.environ.get("LOCAL_TTS_EDGE_FADE_MS", "55"))

app = FastAPI(title="asliCo local voice TTS", version="0.3.0")
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


def prepare_spoken_text(text: str) -> str:
  """Merge sections into continuous speech (no decorative ellipsis cuts)."""
  text = text.replace("…", ".").replace("...", ".")
  lines = [ln.strip() for ln in text.splitlines()]
  blocks: list[str] = []
  buf: list[str] = []
  for ln in lines:
    if not ln:
      if buf:
        blocks.append(" ".join(buf))
        buf = []
      continue
    buf.append(ln)
  if buf:
    blocks.append(" ".join(buf))
  cleaned: list[str] = []
  for b in blocks:
    b = b.strip()
    if not b or b in {".", "…"}:
      continue
    if not b.endswith((".", "!", "?", ";")):
      b += "."
    cleaned.append(b)
  return " ".join(cleaned)


def trim_edges(arr: np.ndarray, sr: int, thresh: float = 0.012, pad_ms: int = 35) -> np.ndarray:
  if arr.size == 0:
    return arr
  energy = np.abs(arr)
  idx = np.where(energy > thresh)[0]
  if idx.size == 0:
    return arr
  pad = int(sr * pad_ms / 1000)
  start = max(0, int(idx[0]) - pad)
  end = min(len(arr), int(idx[-1]) + pad)
  return arr[start:end].copy()


def soft_edges(arr: np.ndarray, sr: int, fade_ms: int = 55) -> np.ndarray:
  n = int(sr * fade_ms / 1000)
  if arr.size < n * 2 + 8:
    return arr
  out = arr.astype(np.float32, copy=True)
  fade = np.linspace(0.0, 1.0, n, dtype=np.float32)
  out[:n] *= fade
  out[-n:] *= fade[::-1]
  return out


def crossfade_join(pieces: list[np.ndarray], sr: int, overlap_ms: int = 110) -> np.ndarray:
  if not pieces:
    return np.zeros(0, dtype=np.float32)
  overlap = max(1, int(sr * overlap_ms / 1000))
  out = pieces[0].astype(np.float32, copy=True)
  for nxt in pieces[1:]:
    nxt = nxt.astype(np.float32, copy=False)
    if out.size < overlap or nxt.size < overlap:
      gap = np.zeros(int(sr * 0.06), dtype=np.float32)
      out = np.concatenate([out, gap, nxt])
      continue
    a = out[-overlap:]
    b = nxt[:overlap]
    fade_out = np.linspace(1.0, 0.0, overlap, dtype=np.float32)
    fade_in = np.linspace(0.0, 1.0, overlap, dtype=np.float32)
    blended = a * fade_out + b * fade_in
    out = np.concatenate([out[:-overlap], blended, nxt[overlap:]])
  return out


def synthesize_chunks(
  text: str,
  language: str,
  ref_path: Path,
  on_progress=None,
) -> bytes:
  tts = get_tts()
  text = prepare_spoken_text(text)
  chunks = split_text(text, max_chars=CHUNK_CHARS)
  chunks = [c for c in chunks if c and c not in {".", "…", "..."}]
  if not chunks:
    raise ValueError("No speakable text after cleanup")

  pieces: list[np.ndarray] = []
  sr = 24000
  total = max(len(chunks), 1)

  for i, chunk in enumerate(chunks):
    if on_progress:
      on_progress(i / total)
    print(f"[{i + 1}/{total}] synthesizing {len(chunk)} chars…")
    arr = synth_one(tts, chunk, language, ref_path)
    arr = trim_edges(arr, sr)
    arr = soft_edges(arr, sr, fade_ms=EDGE_FADE_MS)
    pieces.append(arr)

  if on_progress:
    on_progress(1.0)

  audio = crossfade_join(pieces, sr, overlap_ms=CROSSFADE_MS)
  peak = float(np.max(np.abs(audio))) if audio.size else 0.0
  if peak > 1e-4:
    audio = audio * (0.85 / peak)

  buf = io.BytesIO()
  sf.write(buf, audio.astype(np.float32), sr, format="WAV")
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
      return np.zeros(int(24000 * 0.05), dtype=np.float32)
    mid = len(chunk) // 2
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
    return crossfade_join(parts, 24000, overlap_ms=80) if parts else np.zeros(0, dtype=np.float32)


def split_text(text: str, max_chars: int) -> list[str]:
  text = " ".join(text.split())
  if len(text) <= max_chars:
    return [text]
  parts: list[str] = []
  remaining = text
  while len(remaining) > max_chars:
    cut = remaining.rfind(". ", 0, max_chars)
    if cut < max_chars * 0.4:
      cut = remaining.rfind("; ", 0, max_chars)
    if cut < max_chars * 0.4:
      cut = remaining.rfind(", ", 0, max_chars)
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
    "crossfade_ms": CROSSFADE_MS,
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
