/**
 * Local XTTS voice-clone TTS (tools/local-voice server).
 * Used when TTS_PROVIDER=local and LOCAL_TTS_URL is set.
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

  const chunks = splitForTts(trimmed, 1800)
  const buffers: ArrayBuffer[] = []

  for (const chunk of chunks) {
    const res = await fetch(`${base}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunk,
        language: options?.language ?? 'tr',
        ref: options?.ref ?? process.env.LOCAL_VOICE_REF ?? 'ref_1.wav',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Local TTS error (${res.status}): ${body.slice(0, 400)}`)
    }

    buffers.push(await res.arrayBuffer())
  }

  return {
    audio: concatArrayBuffers(buffers),
    contentType: 'audio/wav',
  }
}

export function isLocalTtsEnabled(): boolean {
  const provider = (process.env.TTS_PROVIDER ?? '').trim().toLowerCase()
  if (provider === 'local' || provider === 'xtts') return true
  if (provider === 'elevenlabs') return false
  return Boolean(process.env.LOCAL_TTS_URL?.trim())
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
