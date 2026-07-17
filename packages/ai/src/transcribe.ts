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
