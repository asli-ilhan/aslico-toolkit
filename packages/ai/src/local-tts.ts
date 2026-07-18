/**
 * Local XTTS voice-clone TTS (tools/local-voice server).
 * Used when TTS_PROVIDER=local and LOCAL_TTS_URL is set.
 *
 * Sends the full script in one request — the Python server already
 * chunks text and concatenates PCM into a single valid WAV.
 */

export interface LocalSpeakOptions {
  language?: string
  ref?: string
  baseUrl?: string
}

export async function synthesizeSpeechLocal(
  text: string,
  options?: LocalSpeakOptions,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const base = (options?.baseUrl ?? process.env.LOCAL_TTS_URL ?? 'http://127.0.0.1:8765').replace(
    /\/$/,
    '',
  )
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Empty text for TTS')

  const res = await fetch(`${base}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: trimmed,
      language: options?.language ?? 'tr',
      ref: options?.ref ?? process.env.LOCAL_VOICE_REF ?? 'ref_1.wav',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Local TTS error (${res.status}): ${body.slice(0, 400)}`)
  }

  return {
    audio: await res.arrayBuffer(),
    contentType: res.headers.get('content-type') || 'audio/wav',
  }
}

export function isLocalTtsEnabled(): boolean {
  const provider = (process.env.TTS_PROVIDER ?? '').trim().toLowerCase()
  if (provider === 'local' || provider === 'xtts') return true
  if (provider === 'elevenlabs') return false
  return Boolean(process.env.LOCAL_TTS_URL?.trim())
}
