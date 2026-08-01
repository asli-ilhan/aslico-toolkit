import type { LiveSttHandlers, LiveSttLanguage } from './live-stt'

const TARGET_SAMPLE_RATE = 16000
const SLICE_INTERVAL_MS = 900
const MAX_SECONDS = 90

const WORKLET_SOURCE = `
class PcmTap extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (input && input[0]) {
      this.port.postMessage(new Float32Array(input[0]))
    }
    return true
  }
}
registerProcessor('pcm-tap', PcmTap)
`

function floatToPcm16(chunks: Float32Array[], totalLength: number): ArrayBuffer {
  const out = new Int16Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]))
      out[offset + i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    offset += chunk.length
  }
  return out.buffer
}

/**
 * Live-ish STT without a browser Deepgram token.
 * Captures raw PCM and re-transcribes the growing utterance through our server
 * roughly once a second, so the transcript appears while the key is held and the
 * final text is ready the moment it is released.
 */
export class SliceStreamSTT {
  private ctx: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private node: AudioWorkletNode | ScriptProcessorNode | null = null
  private chunks: Float32Array[] = []
  private totalSamples = 0
  private sentSamples = 0
  private inFlight = false
  private stopped = false
  private text = ''
  private language: string | undefined
  private timer: ReturnType<typeof setInterval> | null = null
  private handlers: LiveSttHandlers = {}
  private lang: LiveSttLanguage = 'auto'

  get transcript(): string {
    return this.text
  }

  get detectedLanguage(): string | undefined {
    return this.language
  }

  async start(
    stream: MediaStream,
    language: LiveSttLanguage,
    handlers: LiveSttHandlers = {},
  ): Promise<void> {
    this.stopped = false
    this.chunks = []
    this.totalSamples = 0
    this.sentSamples = 0
    this.text = ''
    this.handlers = handlers
    this.lang = language

    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor({ sampleRate: TARGET_SAMPLE_RATE })
    this.ctx = ctx
    if (ctx.state === 'suspended') await ctx.resume()

    const source = ctx.createMediaStreamSource(stream)
    this.source = source

    const onSamples = (frame: Float32Array) => {
      if (this.stopped) return
      if (this.totalSamples >= TARGET_SAMPLE_RATE * MAX_SECONDS) return
      this.chunks.push(frame)
      this.totalSamples += frame.length
    }

    let wired = false
    try {
      const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' })
      const moduleUrl = URL.createObjectURL(blob)
      await ctx.audioWorklet.addModule(moduleUrl)
      URL.revokeObjectURL(moduleUrl)
      const worklet = new AudioWorkletNode(ctx, 'pcm-tap')
      worklet.port.onmessage = (e) => onSamples(e.data as Float32Array)
      source.connect(worklet)
      // Keep the graph pulling without audible output.
      const silent = ctx.createGain()
      silent.gain.value = 0
      worklet.connect(silent).connect(ctx.destination)
      this.node = worklet
      wired = true
    } catch {
      wired = false
    }

    if (!wired) {
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (e) => onSamples(new Float32Array(e.inputBuffer.getChannelData(0)))
      const silent = ctx.createGain()
      silent.gain.value = 0
      source.connect(processor)
      processor.connect(silent).connect(ctx.destination)
      this.node = processor
    }

    this.timer = setInterval(() => {
      void this.flush(false)
    }, SLICE_INTERVAL_MS)

    handlers.onOpen?.()
  }

  private langParam(): string {
    return this.lang === 'tr' ? 'tr' : this.lang === 'en' ? 'en' : 'auto'
  }

  /** Re-transcribe the whole utterance so partial text is always coherent. */
  private async flush(final: boolean): Promise<void> {
    if (!final && (this.inFlight || this.stopped)) return
    if (this.totalSamples === 0) return
    if (!final && this.totalSamples === this.sentSamples) return
    if (!final && this.totalSamples < TARGET_SAMPLE_RATE * 0.4) return

    this.inFlight = true
    const snapshotLength = this.totalSamples
    const pcm = floatToPcm16(this.chunks, snapshotLength)
    this.sentSamples = snapshotLength

    try {
      const res = await fetch(
        `/api/modules/meeting-copilot/transcribe-slice?sr=${TARGET_SAMPLE_RATE}&lang=${this.langParam()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: pcm,
        },
      )
      const data = (await res.json()) as { text?: string; language?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Slice STT failed')
      const text = (data.text ?? '').trim()
      if (data.language) this.language = data.language
      if (text) {
        this.text = text
        if (final) this.handlers.onFinal?.(text)
        else this.handlers.onInterim?.(text)
      }
    } catch (err) {
      if (final) throw err
      this.handlers.onError?.(err instanceof Error ? err.message : 'Slice STT failed')
    } finally {
      this.inFlight = false
    }
  }

  /** Stop capture and return the best transcript (final pass over full audio). */
  async stop(): Promise<string> {
    this.stopped = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.teardownGraph()

    try {
      await this.flush(true)
    } catch {
      // keep last interim text
    }
    await this.closeContext()
    return this.text
  }

  abort() {
    this.stopped = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.teardownGraph()
    void this.closeContext()
    this.chunks = []
    this.totalSamples = 0
  }

  private teardownGraph() {
    try {
      if (this.node && 'port' in this.node) (this.node as AudioWorkletNode).port.onmessage = null
      if (this.node && 'onaudioprocess' in this.node) {
        ;(this.node as ScriptProcessorNode).onaudioprocess = null
      }
      this.node?.disconnect()
      this.source?.disconnect()
    } catch {
      // ignore
    }
    this.node = null
    this.source = null
  }

  private async closeContext() {
    const ctx = this.ctx
    this.ctx = null
    if (!ctx) return
    try {
      await ctx.close()
    } catch {
      // ignore
    }
  }
}
