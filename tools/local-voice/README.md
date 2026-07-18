# Local Self Therapy voice clone (XTTS)

## What this is

Runs **Coqui XTTS v2** on your Mac (M4 Max). Clones voice from short reference WAVs
cut from your licensed source sessions. **Nothing is sent to ElevenLabs.**

Zero-shot clone (not a multi-day fine-tune): the model hears ~18s of reference audio
and speaks new Turkish text in that timbre. Good enough for local sleep scripts;
optional longer fine-tune can come later using `data/dataset/`.

## Setup (once)

```bash
cd tools/local-voice
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
chmod +x prepare_samples.sh
./prepare_samples.sh   # if data/refs is empty — reads ~/Downloads MP3s
```

First model load downloads ~2GB weights into the TTS cache.

Agree to Coqui’s non-commercial CPML for personal use (or buy a commercial license):
`export COQUI_TOS_AGREED=1` — the server sets this by default for local runs.

## Run the local server

```bash
cd tools/local-voice
source .venv/bin/activate
LOCAL_TTS_GPU=0 python server.py
# → http://127.0.0.1:8765
```

Progress API (used by the web UI):

```bash
curl -X POST http://127.0.0.1:8765/jobs -H 'Content-Type: application/json' \
  -d '{"text":"…","language":"tr","ref":"ref_1.wav"}'
# → {"id":"…"}
curl http://127.0.0.1:8765/jobs/<id>   # { status, progress }
curl -o out.wav http://127.0.0.1:8765/jobs/<id>/audio
```

Health: `curl http://127.0.0.1:8765/health`

## Speak from CLI

```bash
# server must be running
python speak_cli.py --text "Gözlerini yavaşça kapatıyorsun…" --ref ref_1.wav
open out/speak.wav
```

## Point the web app at local TTS

In `apps/web/.env.local`:

```bash
TTS_PROVIDER=local
LOCAL_TTS_URL=http://127.0.0.1:8765
LOCAL_VOICE_REF=ref_1.wav
```

Then `pnpm --filter @aslico/web dev` (or your usual next dev).  
Self Therapy → Seslendir uses local clone; production/Vercel can keep ElevenLabs or stay unused.

## Pick a reference

Refs in `data/refs/`:

| File | Source clip |
|------|-------------|
| ref_1.wav … ref_6.wav | From your six source MP3s (offset ~0:45, 18s) |

Try different `--ref` / `LOCAL_VOICE_REF` until the tone matches the session you like.

## Notes

- Local only: bind is `127.0.0.1` by default.
- Long scripts are chunked (~220 chars); synthesis can take minutes on first runs.
- Set `LOCAL_TTS_GPU=0` to force CPU if GPU path misbehaves.
- `data/dataset/*.wav` (~90s each) is reserved for a future fine-tune pass — not required for day-one clone.
