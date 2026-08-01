export type LiveSttLanguage = 'auto' | 'tr' | 'en'

export interface LiveSttHandlers {
  onInterim?: (text: string) => void
  onFinal?: (text: string) => void
  onError?: (message: string) => void
  onOpen?: () => void
}

/**
 * Browser Deepgram live STT via temporary Bearer token.
 * Sends MediaRecorder webm/opus chunks over WebSocket.
 */
export class LiveDeepgramSTT {
  private ws: WebSocket | null = null
  private recorder: MediaRecorder | null = null
  private finals: string[] = []
  private interim = ''
  private closed = false

  get transcript(): string {
    const parts = [...this.finals]
    if (this.interim.trim()) parts.push(this.interim.trim())
    return parts.join(' ').replace(/\s+/g, ' ').trim()
  }

  async start(
    stream: MediaStream,
    accessToken: string,
    language: LiveSttLanguage,
    handlers: LiveSttHandlers = {},
  ): Promise<void> {
    this.closed = false
    this.finals = []
    this.interim = ''

    const params = new URLSearchParams({
      model: 'nova-3',
      interim_results: 'true',
      smart_format: 'true',
      punctuate: 'true',
      endpointing: '300',
    })
    if (language === 'tr' || language === 'en') {
      params.set('language', language)
    } else {
      params.set('language', 'multi')
    }

    const base = `wss://api.deepgram.com/v1/listen?${params}`
    const ws = await openDeepgramSocket(base, accessToken)
    this.ws = ws
    handlers.onOpen?.()

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as {
          type?: string
          is_final?: boolean
          channel?: { alternatives?: { transcript?: string }[] }
        }
        if (data.type && data.type !== 'Results') return
        const text = data.channel?.alternatives?.[0]?.transcript?.trim() ?? ''
        if (!text) return
        if (data.is_final) {
          this.finals.push(text)
          this.interim = ''
          handlers.onFinal?.(this.transcript)
        } else {
          this.interim = text
          handlers.onInterim?.(this.transcript)
        }
      } catch {
        // ignore non-JSON keepalive
      }
    }

    ws.onerror = () => handlers.onError?.('Deepgram connection error')
    ws.onclose = () => {
      this.ws = null
    }

    const mime = pickMime()
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream)
    this.recorder = recorder
    recorder.ondataavailable = (e) => {
      if (this.closed || !e.data.size || ws.readyState !== WebSocket.OPEN) return
      void e.data.arrayBuffer().then((buf) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(buf)
      })
    }
    recorder.start(250)
  }

  /** Finalize socket and return best transcript. */
  async stop(): Promise<string> {
    this.closed = true
    const recorder = this.recorder
    this.recorder = null
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
        recorder.stop()
        setTimeout(resolve, 400)
      })
    }

    const ws = this.ws
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'CloseStream' }))
      } catch {
        // ignore
      }
      await new Promise<void>((resolve) => {
        const done = () => resolve()
        ws.addEventListener('close', done, { once: true })
        setTimeout(() => {
          try {
            ws.close()
          } catch {
            // ignore
          }
          resolve()
        }, 600)
      })
    }
    this.ws = null
    return this.transcript
  }

  abort() {
    this.closed = true
    try {
      this.recorder?.stop()
    } catch {
      // ignore
    }
    this.recorder = null
    try {
      this.ws?.close()
    } catch {
      // ignore
    }
    this.ws = null
  }
}

function waitOpen(ws: WebSocket, ms = 8000): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        ws.close()
      } catch {
        // ignore
      }
      reject(new Error('Deepgram WS timeout'))
    }, ms)
    ws.onopen = () => {
      clearTimeout(timer)
      resolve(ws)
    }
    ws.onerror = () => {
      clearTimeout(timer)
      reject(new Error('Deepgram WS error'))
    }
  })
}

/** Prefer bearer subprotocol; fall back to query Authorization. */
async function openDeepgramSocket(baseUrl: string, accessToken: string): Promise<WebSocket> {
  try {
    const ws = new WebSocket(baseUrl, ['bearer', accessToken])
    return await waitOpen(ws)
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?'
    const url = `${baseUrl}${sep}authorization=${encodeURIComponent(`Bearer ${accessToken}`)}`
    const ws = new WebSocket(url)
    return await waitOpen(ws)
  }
}

function pickMime(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return undefined
}

export async function fetchDeepgramToken(): Promise<string> {
  const res = await fetch('/api/modules/meeting-copilot/deepgram-token', { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Token failed')
  return String(data.accessToken)
}
