export interface TranscribeOptions {
  language?: string
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'mp3':
    case 'mpeg':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'm4a':
      return 'audio/mp4'
    case 'webm':
      return 'video/webm'
    case 'ogg':
      return 'audio/ogg'
    default:
      return 'application/octet-stream'
  }
}

function deepgramParams(options?: TranscribeOptions): URLSearchParams {
  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    detect_language: 'true',
  })
  if (options?.language) {
    params.set('language', options.language)
  }
  return params
}

function parseDeepgramResponse(data: unknown): { text: string; language?: string } {
  const typed = data as {
    results?: {
      channels?: {
        alternatives?: { transcript?: string }[]
        detected_language?: string
      }[]
    }
  }
  const channel = typed.results?.channels?.[0]
  const text = channel?.alternatives?.[0]?.transcript?.trim()
  if (!text) {
    throw new Error('Deepgram returned empty transcript')
  }
  return { text, language: channel?.detected_language }
}

/**
 * Speech-to-text via Deepgram (Claude API does not accept audio input).
 * Anthropic cookbook pattern: STT → Claude for analysis/summary.
 */
export async function transcribeAudio(
  file: Blob | ArrayBuffer,
  filename: string,
  options?: TranscribeOptions,
): Promise<{ text: string; language?: string }> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is not set')
  }

  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const params = deepgramParams(options)

  const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': mimeFromFilename(filename),
    },
    body: buffer,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Deepgram API error (${response.status}): ${body}`)
  }

  return parseDeepgramResponse(await response.json())
}

/** Pitch jargon nova-3 otherwise mangles (English keyterms only). */
const MEETING_KEYTERMS = ['ARR', 'MRR', 'CAC', 'LTV', 'runway', 'burn', 'GTM', 'churn', 'payback']

async function listenOnce(
  apiKey: string,
  buffer: ArrayBuffer,
  contentType: string,
  language: 'tr' | 'en',
): Promise<{ text: string; confidence: number; language: 'tr' | 'en' }> {
  const params = new URLSearchParams({
    model: 'nova-3',
    language,
    smart_format: 'true',
    punctuate: 'true',
  })
  if (language === 'en') {
    for (const term of MEETING_KEYTERMS) params.append('keyterm', term)
  }

  const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': contentType },
    body: buffer,
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Deepgram API error (${response.status}): ${body}`)
  }
  const data = (await response.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string; confidence?: number }[] }[] }
  }
  const alt = data.results?.channels?.[0]?.alternatives?.[0]
  return {
    text: (alt?.transcript ?? '').trim(),
    confidence: Number(alt?.confidence ?? 0),
    language,
  }
}

/**
 * Meeting-grade STT. nova-3 `multi` does not cover Turkish and nova-2 returns an empty
 * transcript for it, so auto mode races Turkish and English and keeps the confident one.
 */
export async function transcribeMeetingAudio(
  file: Blob | ArrayBuffer,
  filename: string,
  languageMode: 'auto' | 'tr' | 'en' = 'auto',
): Promise<{ text: string; language?: string }> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not set')

  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const contentType = mimeFromFilename(filename)

  if (languageMode === 'tr' || languageMode === 'en') {
    const single = await listenOnce(apiKey, buffer, contentType, languageMode)
    if (!single.text) throw new Error('Deepgram returned empty transcript')
    return { text: single.text, language: single.language }
  }

  const results = await Promise.allSettled([
    listenOnce(apiKey, buffer, contentType, 'tr'),
    listenOnce(apiKey, buffer, contentType, 'en'),
  ])
  const candidates = results
    .filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof listenOnce>>> =>
        r.status === 'fulfilled',
    )
    .map((r) => r.value)
    .filter((c) => c.text.length > 0)

  if (!candidates.length) {
    const failure = results.find((r) => r.status === 'rejected')
    if (failure && failure.status === 'rejected') {
      throw failure.reason instanceof Error ? failure.reason : new Error('Deepgram failed')
    }
    throw new Error('Deepgram returned empty transcript')
  }

  // Slight Turkish bias: Turkish speech peppered with English jargon.
  const best = candidates.sort(
    (a, b) =>
      b.confidence +
      (b.language === 'tr' ? 0.04 : 0) -
      (a.confidence + (a.language === 'tr' ? 0.04 : 0)),
  )[0]
  return { text: best.text, language: best.language }
}

/** Deepgram fetches the audio itself — used when file bypasses Vercel 4.5 MB body limit. */
export async function transcribeAudioFromUrl(
  audioUrl: string,
  options?: TranscribeOptions,
): Promise<{ text: string; language?: string }> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is not set')
  }

  const params = deepgramParams(options)
  const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: audioUrl }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Deepgram API error (${response.status}): ${body}`)
  }

  return parseDeepgramResponse(await response.json())
}
