#!/usr/bin/env bash
# Re-extract reference + dataset clips from source MP3s.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="${1:-$HOME/Downloads}"
REF_DIR="$ROOT/data/refs"
DS_DIR="$ROOT/data/dataset"
mkdir -p "$REF_DIR" "$DS_DIR"

files=(
  "YTDown.com_YouTube_Media_9eVl2N6bbPA_009_128k (1).mp3"
  "YTDown.com_YouTube_Media_37yazTbgD5E_009_128k (1).mp3"
  "YTDown.com_YouTube_Media_iPiHkRKikb8_009_128k (1).mp3"
  "YTDown.com_YouTube_Media_kb7-n58A6q0_009_128k (1).mp3"
  "YTDown.com_YouTube_Media_Uu6ycnhf3Rg_009_128k (1).mp3"
  "YTDown.com_YouTube_Media_xKNVPT-_QBI_001_1080p (1).mp3"
)

i=1
for f in "${files[@]}"; do
  in="$SRC_DIR/$f"
  if [[ ! -f "$in" ]]; then
    echo "skip missing: $f" >&2
    continue
  fi
  ffmpeg -y -hide_banner -loglevel error -ss 45 -t 18 -i "$in" -ar 22050 -ac 1 "$REF_DIR/ref_${i}.wav"
  ffmpeg -y -hide_banner -loglevel error -ss 60 -t 90 -i "$in" -ar 22050 -ac 1 "$DS_DIR/clip_${i}.wav"
  echo "ok $i <- $f"
  i=$((i + 1))
done
echo "refs → $REF_DIR"
echo "dataset → $DS_DIR"
