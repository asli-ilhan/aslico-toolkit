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
import subprocess
import tempfile
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
# XTTS blows up on long GPT sequences — keep chunks moderate; breath gaps between them
CHUNK_CHARS = int(os.environ.get("LOCAL_TTS_CHUNK_CHARS", "160"))
CROSSFADE_MS = int(os.environ.get("LOCAL_TTS_CROSSFADE_MS", "80"))
EDGE_FADE_MS = int(os.environ.get("LOCAL_TTS_EDGE_FADE_MS", "70"))
# Hypnosis pacing: <1.0 = slower; breath pause between sentences
SPEECH_SPEED = float(os.environ.get("LOCAL_TTS_SPEED", "0.82"))
BREATH_MS = int(os.environ.get("LOCAL_TTS_BREATH_MS", "480"))

app = FastAPI(title="asliCo local voice TTS", version="0.4.0")
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


def join_with_breath(
  pieces: list[np.ndarray],
  sr: int,
  breath_ms: int = 480,
  overlap_ms: int = 60,
) -> np.ndarray:
  """Soft edge into a short silence (breath), then next sentence — hypnosis pacing."""
  if not pieces:
    return np.zeros(0, dtype=np.float32)
  breath = np.zeros(max(1, int(sr * breath_ms / 1000)), dtype=np.float32)
  out = pieces[0].astype(np.float32, copy=True)
  for nxt in pieces[1:]:
    nxt = nxt.astype(np.float32, copy=False)
    # Tiny crossfade into silence so the cut isn't clicky, then hold the breath
    if overlap_ms > 0 and out.size > int(sr * overlap_ms / 1000):
      n = int(sr * overlap_ms / 1000)
      fade = np.linspace(1.0, 0.0, n, dtype=np.float32)
      out[-n:] *= fade
    out = np.concatenate([out, breath, nxt])
  return out


def wav_bytes_from_audio(audio: np.ndarray, sr: int) -> bytes:
  buf = io.BytesIO()
  sf.write(buf, audio.astype(np.float32), sr, format="WAV")
  return buf.getvalue()


def encode_mp3(wav_data: bytes, bitrate: str = "64k") -> bytes | None:
  """Compress for upload/playback; returns None if ffmpeg unavailable."""
  try:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wf:
      wf.write(wav_data)
      wav_path = wf.name
    mp3_path = wav_path.replace(".wav", ".mp3")
    try:
      subprocess.run(
        [
          "ffmpeg",
          "-y",
          "-loglevel",
          "error",
          "-i",
          wav_path,
          "-codec:a",
          "libmp3lame",
          "-b:a",
          bitrate,
          mp3_path,
        ],
        check=True,
        timeout=120,
      )
      return Path(mp3_path).read_bytes()
    finally:
      Path(wav_path).unlink(missing_ok=True)
      Path(mp3_path).unlink(missing_ok=True)
  except (FileNotFoundError, subprocess.SubprocessError, OSError) as exc:
    print(f"mp3 encode skipped: {exc}")
    return None


def synthesize_chunks(
  text: str,
  language: str,
  ref_path: Path,
  on_progress=None,
) -> tuple[bytes, str, float]:
  """Returns (audio_bytes, content_type, duration_seconds). Prefers MP3 when ffmpeg exists."""
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
    print(f"[{i + 1}/{total}] synthesizing {len(chunk)} chars @ speed={SPEECH_SPEED}…")
    arr = synth_one(tts, chunk, language, ref_path)
    arr = trim_edges(arr, sr)
    arr = soft_edges(arr, sr, fade_ms=EDGE_FADE_MS)
    pieces.append(arr)

  if on_progress:
    on_progress(1.0)

  audio = join_with_breath(pieces, sr, breath_ms=BREATH_MS, overlap_ms=min(60, CROSSFADE_MS))
  peak = float(np.max(np.abs(audio))) if audio.size else 0.0
  if peak > 1e-4:
    audio = audio * (0.85 / peak)

  duration = float(len(audio) / sr) if audio.size else 0.0
  print(f"joined {len(pieces)} phrases + {BREATH_MS}ms breath → {duration:.1f}s")
  wav_data = wav_bytes_from_audio(audio, sr)
  mp3 = encode_mp3(wav_data)
  if mp3:
    print(f"encoded mp3 {len(wav_data)} → {len(mp3)} bytes ({duration:.1f}s)")
    return mp3, "audio/mpeg", duration
  return wav_data, "audio/wav", duration


def synth_one(tts, chunk: str, language: str, ref_path: Path) -> np.ndarray:
  """Synthesize one chunk; on XTTS index errors, split smaller and retry."""
  try:
    with _tts_lock:
      wav = tts.tts(
        text=chunk,
        speaker_wav=str(ref_path),
        language=language,
        speed=SPEECH_SPEED,
        split_sentences=False,
      )
    return np.asarray(wav, dtype=np.float32)
  except TypeError:
    # Older Coqui builds may not accept speed=
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
    return join_with_breath(parts, 24000, breath_ms=220, overlap_ms=40) if parts else np.zeros(0, dtype=np.float32)


def split_into_sentences(text: str) -> list[str]:
  import re

  text = " ".join(text.split())
  if not text:
    return []
  parts = re.split(r"(?<=[.!?])\s+", text)
  return [p.strip() for p in parts if p.strip()]


def split_long_phrase(text: str, max_chars: int) -> list[str]:
  if len(text) <= max_chars:
    return [text]
  parts: list[str] = []
  remaining = text
  while len(remaining) > max_chars:
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


def split_text(text: str, max_chars: int) -> list[str]:
  """One breath-sized unit per sentence; overlong sentences are split further."""
  sentences = split_into_sentences(text)
  if not sentences:
    return split_long_phrase(" ".join(text.split()), max_chars)
  parts: list[str] = []
  for sent in sentences:
    parts.extend(split_long_phrase(sent, max_chars))
  return parts


def run_job(job_id: str, text: str, language: str, ref_path: Path) -> None:
  def on_progress(p: float) -> None:
    with _jobs_lock:
      job = _jobs.get(job_id)
      if job:
        job["progress"] = round(min(max(p, 0.0), 0.99) * 100)

  try:
    data, content_type, duration = synthesize_chunks(
      text, language, ref_path, on_progress=on_progress
    )
    ext = "mp3" if "mpeg" in content_type else "wav"
    path = OUT / f"{job_id}.{ext}"
    path.write_bytes(data)
    with _jobs_lock:
      job = _jobs.get(job_id)
      if job:
        job["status"] = "done"
        job["progress"] = 100
        job["path"] = str(path)
        job["content_type"] = content_type
        job["duration_seconds"] = round(duration, 1)
        job["bytes"] = len(data)
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
    "speech_speed": SPEECH_SPEED,
    "breath_ms": BREATH_MS,
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
      "content_type": None,
      "duration_seconds": None,
      "bytes": None,
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
    "duration_seconds": job.get("duration_seconds"),
    "bytes": job.get("bytes"),
    "content_type": job.get("content_type"),
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
  media = job.get("content_type") or "audio/wav"
  return Response(content=data, media_type=media)


@app.post("/speak")
def speak(body: SpeakRequest):
  text = body.text.strip()
  if not text:
    raise HTTPException(400, "Empty text")
  ref_path = resolve_ref(body.ref)
  try:
    data, content_type, _duration = synthesize_chunks(text, body.language, ref_path)
  except Exception as exc:  # noqa: BLE001
    raise HTTPException(500, str(exc)[:400]) from exc
  return Response(content=data, media_type=content_type)


if __name__ == "__main__":
  import uvicorn

  get_tts()
  uvicorn.run(app, host=HOST, port=PORT, log_level="info")
