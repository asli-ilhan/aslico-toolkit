#!/usr/bin/env python3
"""CLI: synthesize a Self Therapy script with the local XTTS clone."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent


def main() -> int:
  p = argparse.ArgumentParser(description="Local voice TTS for Self Therapy")
  p.add_argument("--text", help="Text to speak")
  p.add_argument("--file", type=Path, help="UTF-8 text file")
  p.add_argument("--out", type=Path, default=ROOT / "out" / "speak.wav")
  p.add_argument("--url", default="http://127.0.0.1:8765/speak")
  p.add_argument("--ref", default="ref_1.wav")
  p.add_argument("--language", default="tr")
  args = p.parse_args()

  if args.file:
    text = args.file.read_text(encoding="utf-8")
  elif args.text:
    text = args.text
  else:
    text = sys.stdin.read()

  text = text.strip()
  if not text:
    print("No text", file=sys.stderr)
    return 1

  r = httpx.post(
    args.url,
    json={"text": text, "language": args.language, "ref": args.ref},
    timeout=600.0,
  )
  r.raise_for_status()
  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_bytes(r.content)
  print(f"Wrote {args.out} ({len(r.content)} bytes)")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
