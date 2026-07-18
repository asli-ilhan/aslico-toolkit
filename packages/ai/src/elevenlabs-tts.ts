/**
 * ElevenLabs text-to-speech — calm voice for Self Therapy sleep scripts.
 */

export interface SpeakOptions {
  voiceId?: string
  /** 0–1, lower = calmer / more consistent */
  stability?: number
  similarityBoost?: number
  style?: number
  modelId?: string
}

const DEFAULT_VOICE =
  process.env.ELEVENLABS_VOICE_ID?.trim() ||
  // Multilingual calm default (Sarah) — override with ELEVENLABS_VOICE_ID
  'EXAVITQu4vr4xnSDxMaL'

export async function synthesizeSpeech(
  text: string,
  options?: SpeakOptions,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set')
  }

  const voiceId = options?.voiceId?.trim() || DEFAULT_VOICE
  const modelId = options?.modelId ?? 'eleven_multilingual_v2'
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Empty text for TTS')

  // ElevenLabs has per-request limits; chunk long scripts
  const chunks = splitForTts(trimmed, 2400)
  const buffers: ArrayBuffer[] = []

  for (const chunk of chunks) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: chunk,
        model_id: modelId,
        voice_settings: {
          stability: options?.stability ?? 0.55,
          similarity_boost: options?.similarityBoost ?? 0.65,
          style: options?.style ?? 0.15,
          use_speaker_boost: true,
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      if (res.status === 402 || /paid_plan_required|library voices/i.test(body)) {
        throw new Error(
          'ELEVENLABS_PAID_VOICE: This voice needs a paid ElevenLabs plan (library voices). Use a premade voice ID or upgrade.',
        )
      }
      if (/quota_exceeded|credits remaining/i.test(body)) {
        throw new Error(
          'ELEVENLABS_QUOTA: ElevenLabs credits exhausted. Use local TTS (TTS_PROVIDER=local + tools/local-voice server) on localhost.',
        )
      }
      throw new Error(`ElevenLabs TTS error (${res.status}): ${body.slice(0, 400)}`)
    }

    buffers.push(await res.arrayBuffer())
  }

  return { audio: concatArrayBuffers(buffers), contentType: 'audio/mpeg' }
}

function splitForTts(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const parts: string[] = []
  let remaining = text
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf('\n\n', maxChars)
    if (cut < maxChars * 0.4) cut = remaining.lastIndexOf('. ', maxChars)
    if (cut < maxChars * 0.4) cut = remaining.lastIndexOf(' ', maxChars)
    if (cut < 1) cut = maxChars
    parts.push(remaining.slice(0, cut + 1).trim())
    remaining = remaining.slice(cut + 1).trim()
  }
  if (remaining) parts.push(remaining)
  return parts.filter(Boolean)
}

function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((n, b) => n + b.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const b of buffers) {
    out.set(new Uint8Array(b), offset)
    offset += b.byteLength
  }
  return out.buffer
}
