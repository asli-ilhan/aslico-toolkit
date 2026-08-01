'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button, cn } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'
import { fetchDeepgramToken, LiveDeepgramSTT } from '@/lib/meeting-copilot/live-stt'
import { SliceStreamSTT } from '@/lib/meeting-copilot/slice-stt'

type Tab = 'pool' | 'brief' | 'live'
type DocType = 'pitch' | 'metrics' | 'faq' | 'strategy' | 'product' | 'competitor' | 'note' | 'answer-template'
type LanguageMode = 'auto' | 'tr' | 'en'

interface KnowledgeDoc {
  id: string
  title: string
  doc_type: DocType
  tags: string[]
  content_text: string
  created_at: string
}

interface MeetingSession {
  id: string
  counterparty: string
  focus: string
  language_mode: LanguageMode
  tag_filter: string[]
  status: string
  started_at: string
}

interface CueAnswer {
  oneliner: string
  script: string
  bullets: string[]
  language: 'tr' | 'en'
  confidence: 'high' | 'medium' | 'low'
}

interface MeetingTurn {
  id: string
  question_text: string
  answer_json: CueAnswer
  detected_language: string | null
  latency_ms: number | null
  created_at: string
  pending?: boolean
  /** Network-complete answer; typewriter reveals into answer_json */
  target_answer?: CueAnswer
  streaming?: boolean
}

const DOC_TYPES: DocType[] = [
  'pitch',
  'metrics',
  'faq',
  'strategy',
  'product',
  'competitor',
  'note',
  'answer-template',
]

/** Buffered reveal state: target grows from stream deltas while text is written out. */
interface RevealState {
  turnId: string
  target: CueAnswer
  finished: boolean
  fast: boolean
  one: number
  script: number
  bi: number
  bj: number
  phase: 'one' | 'script' | 'bullets' | 'done'
}

function isEditableTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

interface MeetingCopilotViewProps {
  liveOnly?: boolean
  cornerDefault?: boolean
}

export function MeetingCopilotView({ liveOnly = false, cornerDefault = false }: MeetingCopilotViewProps) {
  const { t } = useLocale()
  const mc = t.meetingCopilot
  const mod = getModuleById('meeting-copilot')!

  const [tab, setTab] = useState<Tab>(liveOnly ? 'live' : 'pool')
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [sessions, setSessions] = useState<MeetingSession[]>([])
  const [activeSession, setActiveSession] = useState<MeetingSession | null>(null)
  const [turns, setTurns] = useState<MeetingTurn[]>([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Pool form
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState<DocType>('note')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [savingDoc, setSavingDoc] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Brief form
  const [counterparty, setCounterparty] = useState('')
  const [focus, setFocus] = useState('')
  const [languageMode, setLanguageMode] = useState<LanguageMode>('auto')
  const [tagFilter, setTagFilter] = useState('')
  const [starting, setStarting] = useState(false)

  // Live
  const [holding, setHolding] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [cornerMode, setCornerMode] = useState(liveOnly || cornerDefault)
  const [micError, setMicError] = useState<string | null>(null)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [tokenReady, setTokenReady] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const mediaRef = useRef<MediaStream | null>(null)
  const liveSttRef = useRef<LiveDeepgramSTT | null>(null)
  const batchRecorderRef = useRef<MediaRecorder | null>(null)
  const batchChunksRef = useRef<Blob[]>([])
  const batchModeRef = useRef(false)
  const tokenRef = useRef<string | null>(null)
  const holdingRef = useRef(false)
  const abortStreamRef = useRef<AbortController | null>(null)
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const revealRef = useRef<RevealState | null>(null)
  const sliceSttRef = useRef<SliceStreamSTT | null>(null)
  const liveTokenBlockedRef = useRef(false)

  const fieldClass =
    'w-full min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40'
  const labelClass = 'mb-1 block text-sm text-[var(--muted)]'

  const loadDocs = useCallback(async () => {
    const res = await fetch('/api/modules/meeting-copilot/docs')
    const data = await res.json()
    if (data.warning === 'meeting_copilot_table_missing') {
      setWarning(mc.warnings.tableMissing)
    }
    if (res.ok) setDocs((data.items ?? []) as KnowledgeDoc[])
    else setError(data.error ?? mc.errors.loadFailed)
  }, [mc.warnings.tableMissing, mc.errors.loadFailed])

  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/modules/meeting-copilot/sessions')
    const data = await res.json()
    if (data.warning === 'meeting_copilot_table_missing') {
      setWarning(mc.warnings.tableMissing)
    }
    if (res.ok) {
      const items = (data.items ?? []) as MeetingSession[]
      setSessions(items)
      const active = items.find((s) => s.status === 'active') ?? null
      setActiveSession((prev) => prev ?? active)
    }
  }, [mc.warnings.tableMissing])

  const loadTurns = useCallback(
    async (sessionId: string) => {
      const res = await fetch(`/api/modules/meeting-copilot/sessions/${sessionId}/turns`)
      const data = await res.json()
      if (res.ok) {
        setTurns(
          ((data.items ?? []) as MeetingTurn[]).map((tr) => ({
            ...tr,
            answer_json: tr.answer_json ?? { oneliner: '', script: '', bullets: [], language: 'en', confidence: 'low' },
          })),
        )
      }
    },
    [],
  )

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      await Promise.all([loadDocs(), loadSessions()])
      setLoading(false)
    })()
  }, [loadDocs, loadSessions])

  useEffect(() => {
    if (activeSession?.id) void loadTurns(activeSession.id)
  }, [activeSession?.id, loadTurns])

  async function addDoc() {
    if (!content.trim()) return
    setSavingDoc(true)
    setError(null)
    const res = await fetch('/api/modules/meeting-copilot/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim() || mc.untitled,
        docType,
        tags,
        content: content.trim(),
      }),
    })
    const data = await res.json()
    setSavingDoc(false)
    if (!res.ok) {
      if (data.error === 'meeting_copilot_table_missing') setWarning(mc.warnings.tableMissing)
      setError(data.error ?? mc.errors.saveFailed)
      return
    }
    setTitle('')
    setTags('')
    setContent('')
    await loadDocs()
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.size > 0)
    if (!files.length) return
    setUploading(true)
    setError(null)
    setUploadProgress(mc.uploading)
    const form = new FormData()
    for (const f of files.slice(0, 12)) form.append('files', f)
    try {
      const res = await fetch('/api/modules/meeting-copilot/docs/upload', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'meeting_copilot_table_missing') setWarning(mc.warnings.tableMissing)
        setError(data.error ?? mc.errors.uploadFailed)
        return
      }
      const failed = (data.errors as { filename: string; error: string }[] | undefined) ?? []
      if (failed.length) {
        setError(
          failed.map((e) => `${e.filename}: ${e.error}`).join(' · ') || mc.errors.uploadFailed,
        )
      }
      setUploadProgress(
        mc.uploadDone
          .replace('{ok}', String(data.uploaded ?? 0))
          .replace('{fail}', String(data.failed ?? 0)),
      )
      await loadDocs()
    } catch {
      setError(mc.errors.uploadFailed)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function removeDoc(id: string) {
    await fetch(`/api/modules/meeting-copilot/docs?id=${id}`, { method: 'DELETE' })
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  async function startSession() {
    setStarting(true)
    setError(null)
    const res = await fetch('/api/modules/meeting-copilot/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        counterparty: counterparty.trim(),
        focus: focus.trim(),
        languageMode,
        tagFilter,
      }),
    })
    const data = await res.json()
    setStarting(false)
    if (!res.ok) {
      if (data.error === 'meeting_copilot_table_missing') setWarning(mc.warnings.tableMissing)
      setError(data.error ?? mc.errors.sessionFailed)
      return
    }
    setActiveSession(data.item as MeetingSession)
    setTurns([])
    await loadSessions()
    setTab('live')
  }

  async function endSession() {
    if (!activeSession) return
    await fetch('/api/modules/meeting-copilot/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeSession.id }),
    })
    setActiveSession(null)
    await loadSessions()
  }

  async function ensureMic(): Promise<MediaStream> {
    if (mediaRef.current) return mediaRef.current
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRef.current = stream
    return stream
  }

  async function ensureToken(): Promise<string> {
    if (tokenRef.current) return tokenRef.current
    const token = await fetchDeepgramToken()
    tokenRef.current = token
    setTokenReady(true)
    return token
  }

  // Warm mic when entering Live; probe the live token once (keys without the
  // grant scope fall back to server-proxied slice STT instead of retrying).
  useEffect(() => {
    if (tab !== 'live') return
    void (async () => {
      try {
        await ensureMic()
      } catch {
        // permission prompted on first Space
      }
      try {
        await ensureToken()
      } catch {
        liveTokenBlockedRef.current = true
        setTokenReady(true)
      }
      // Warm the cue model so the first question is not the slow one.
      void fetch('/api/modules/meeting-copilot/prewarm', { method: 'POST' }).catch(() => {})
    })()
  }, [tab])

  function clearTypewriter() {
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current)
      typewriterRef.current = null
    }
  }

  /**
   * Reveal the buffered answer at a readable pace while the network keeps filling it.
   * The target grows as stream deltas arrive; the writer never waits for the full answer.
   */
  function startReveal(turnId: string, target: CueAnswer, finished = false) {
    revealRef.current = {
      turnId,
      target,
      finished,
      fast: false,
      one: 0,
      script: 0,
      bi: 0,
      bj: 0,
      phase: 'one',
    }
    if (typewriterRef.current) return

    typewriterRef.current = setInterval(() => {
      const st = revealRef.current
      if (!st) {
        clearTypewriter()
        return
      }

      const fullOne = st.target.oneliner || ''
      const fullScript = st.target.script || ''
      const fullBullets = st.target.bullets ?? []

      // Nothing usable parsed yet — keep the "thinking" state instead of blanking.
      if (!fullOne && !fullScript && !fullBullets.length && !st.finished) return

      const pending =
        Math.max(0, fullOne.length - st.one) +
        Math.max(0, fullScript.length - st.script) +
        fullBullets.reduce((acc, b, idx) => {
          if (idx < st.bi) return acc
          if (idx > st.bi) return acc + b.length
          return acc + Math.max(0, b.length - st.bj)
        }, 0)

      // Readable ~30 chars/sec, but speed up when the buffer runs ahead.
      const step = st.fast ? 1000 : Math.max(1, Math.min(6, Math.ceil(pending / 45)))

      if (st.phase === 'one') {
        st.one = Math.min(fullOne.length, st.one + step)
        if (st.one >= fullOne.length && (fullScript.length > 0 || st.finished)) {
          st.phase = 'script'
        }
      } else if (st.phase === 'script') {
        st.script = Math.min(fullScript.length, st.script + step)
        if (st.script >= fullScript.length && (fullBullets.length > 0 || st.finished)) {
          st.phase = 'bullets'
        }
      } else if (st.phase === 'bullets') {
        if (st.bi >= fullBullets.length) {
          if (st.finished) st.phase = 'done'
        } else {
          const bullet = fullBullets[st.bi]
          st.bj = Math.min(bullet.length, st.bj + step)
          const lastBullet = st.bi === fullBullets.length - 1
          if (st.bj >= bullet.length && (!lastBullet || st.finished)) {
            st.bi += 1
            st.bj = 0
          }
        }
      }

      const shown: CueAnswer = {
        oneliner: fullOne.slice(0, st.one),
        script: fullScript.slice(0, st.script),
        bullets: fullBullets
          .slice(0, st.bi + 1)
          .map((b, idx) => (idx < st.bi ? b : b.slice(0, st.bj)))
          .filter((b, idx) => idx < st.bi || b.length > 0),
        language: st.target.language,
        confidence: st.target.confidence,
      }

      const complete =
        st.finished &&
        st.one >= fullOne.length &&
        st.script >= fullScript.length &&
        st.bi >= fullBullets.length

      if (complete) {
        clearTypewriter()
        revealRef.current = null
      }

      setTurns((prev) =>
        prev.map((tr) =>
          tr.id === st.turnId
            ? {
                ...tr,
                answer_json: complete ? st.target : shown,
                target_answer: complete ? undefined : st.target,
                streaming: !complete,
                pending: false,
              }
            : tr,
        ),
      )
    }, 40)
  }

  /** Feed newly streamed text into the active reveal without restarting it. */
  function updateRevealTarget(turnId: string, target: CueAnswer, finished = false) {
    const st = revealRef.current
    if (!st || st.turnId !== turnId) {
      startReveal(turnId, target, finished)
      return
    }
    st.target = target
    st.finished = finished
  }

  /** Snap the reveal to everything received so far. */
  function revealAll(turnId: string) {
    const st = revealRef.current
    if (st && st.turnId === turnId) {
      st.fast = true
      return
    }
    setTurns((prev) =>
      prev.map((tr) =>
        tr.id === turnId && tr.target_answer
          ? {
              ...tr,
              answer_json: tr.target_answer,
              target_answer: undefined,
              streaming: false,
              pending: false,
            }
          : tr,
      ),
    )
  }

  /** Freeze the previous answer in full before a new question takes over. */
  function finalizeReveal() {
    const st = revealRef.current
    clearTypewriter()
    revealRef.current = null
    if (!st) return
    setTurns((prev) =>
      prev.map((tr) =>
        tr.id === st.turnId
          ? {
              ...tr,
              answer_json: st.target,
              target_answer: undefined,
              streaming: false,
              pending: false,
            }
          : tr,
      ),
    )
  }

  async function streamCueAnswer(sessionId: string, questionText: string, tempId: string) {
    abortStreamRef.current?.abort()
    const ac = new AbortController()
    abortStreamRef.current = ac

    const res = await fetch('/api/modules/meeting-copilot/capture/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, questionText }),
      signal: ac.signal,
    })

    if (!res.ok || !res.body) {
      // Fallback non-stream
      const fallback = await fetch('/api/modules/meeting-copilot/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, questionText }),
      })
      const data = await fallback.json()
      if (!fallback.ok) throw new Error(data.error || mc.errors.captureFailed)
      const answer = data.answer as CueAnswer
      const turn = (data.turn as MeetingTurn) ?? {
        id: tempId,
        question_text: questionText,
        answer_json: answer,
        detected_language: answer.language,
        latency_ms: data.latencyMs ?? null,
        created_at: new Date().toISOString(),
      }
      setTurns((prev) => [
        {
          ...turn,
          id: tempId,
          target_answer: answer,
          answer_json: { ...answer, oneliner: '', script: '', bullets: [] },
          streaming: true,
        },
        ...prev.filter((tr) => tr.id !== tempId),
      ])
      startReveal(tempId, answer, true)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let latestPartial: CueAnswer = {
      oneliner: '',
      script: '',
      bullets: [],
      language: 'en',
      confidence: 'medium',
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        try {
          const evt = JSON.parse(payload) as Record<string, unknown>
          if (evt.type === 'error') throw new Error(String(evt.error || mc.errors.captureFailed))
          if (evt.type === 'partial') {
            latestPartial = {
              oneliner: String(evt.oneliner ?? ''),
              script: String(evt.script ?? ''),
              bullets: Array.isArray(evt.bullets) ? (evt.bullets as string[]) : [],
              language: evt.language === 'tr' ? 'tr' : 'en',
              confidence:
                evt.confidence === 'high' || evt.confidence === 'low' ? evt.confidence : 'medium',
            }
            // Start writing immediately — do not wait for the full answer.
            updateRevealTarget(tempId, latestPartial)
          }
          if (evt.type === 'done') {
            const answer = (evt.answer as CueAnswer) || latestPartial
            const turn = evt.turn as MeetingTurn | undefined
            setTurns((prev) =>
              prev.map((tr) =>
                tr.id === tempId
                  ? {
                      ...tr,
                      question_text: questionText,
                      detected_language: answer.language,
                      latency_ms: (evt.latencyMs as number) ?? tr.latency_ms,
                      created_at: turn?.created_at ?? tr.created_at,
                    }
                  : tr,
              ),
            )
            updateRevealTarget(tempId, answer, true)
          }
        } catch (err) {
          if (err instanceof SyntaxError) continue
          throw err
        }
      }
    }
  }

  function startBatchRecorder(stream: MediaStream) {
    batchModeRef.current = true
    batchChunksRef.current = []
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : undefined
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    batchRecorderRef.current = recorder
    recorder.ondataavailable = (e) => {
      if (e.data.size) batchChunksRef.current.push(e.data)
    }
    recorder.start(200)
    setLiveTranscript('…')
  }

  const startHold = useCallback(async () => {
    if (holdingRef.current || capturing || !activeSession) return
    setMicError(null)
    setError(null)
    setLiveTranscript('')
    batchModeRef.current = false
    abortStreamRef.current?.abort()
    finalizeReveal()
    const langMode = activeSession.language_mode || 'auto'

    try {
      const stream = await ensureMic()

      // 1. Direct Deepgram WebSocket (true realtime) when the key can mint tokens.
      let wired = false
      if (!liveTokenBlockedRef.current) {
        try {
          const token = await ensureToken()
          const stt = new LiveDeepgramSTT()
          liveSttRef.current = stt
          await stt.start(stream, token, langMode, {
            onInterim: (text) => setLiveTranscript(text),
            onFinal: (text) => setLiveTranscript(text),
            onError: (msg) => setMicError(msg),
          })
          wired = true
        } catch {
          liveSttRef.current?.abort()
          liveSttRef.current = null
          liveTokenBlockedRef.current = true
          tokenRef.current = null
        }
      }

      // 2. Server-proxied slice STT — live transcript without a browser token.
      if (!wired) {
        try {
          const slice = new SliceStreamSTT()
          sliceSttRef.current = slice
          await slice.start(stream, langMode, {
            onInterim: (text) => setLiveTranscript(text),
            onFinal: (text) => setLiveTranscript(text),
          })
          wired = true
        } catch {
          sliceSttRef.current?.abort()
          sliceSttRef.current = null
        }
      }

      // 3. Last resort: record now, transcribe on release.
      if (!wired) startBatchRecorder(stream)

      holdingRef.current = true
      setHolding(true)
    } catch (err) {
      liveSttRef.current = null
      sliceSttRef.current = null
      batchRecorderRef.current = null
      const message = err instanceof Error ? err.message : mc.errors.micDenied
      if (/token|Deepgram|DEEPGRAM/i.test(message)) setError(mc.errors.noDeepgram)
      else setMicError(mc.errors.micDenied)
    }
  }, [activeSession, capturing, mc.errors.micDenied, mc.errors.noDeepgram])

  const stopHoldAndCapture = useCallback(async () => {
    if (!holdingRef.current) return
    holdingRef.current = false
    setHolding(false)
    if (!activeSession) return

    const usedBatch = batchModeRef.current
    batchModeRef.current = false

    const tempId = `pending-${Date.now()}`
    setCapturing(true)

    try {
      if (usedBatch) {
        const recorder = batchRecorderRef.current
        batchRecorderRef.current = null
        const blob = await new Promise<Blob>((resolve, reject) => {
          if (!recorder) {
            reject(new Error(mc.errors.captureFailed))
            return
          }
          recorder.onstop = () => {
            resolve(new Blob(batchChunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
            batchChunksRef.current = []
          }
          try {
            recorder.stop()
          } catch (err) {
            reject(err instanceof Error ? err : new Error(mc.errors.captureFailed))
          }
        })
        if (blob.size < 400) {
          setError(mc.errors.tooShort)
          return
        }

        setTurns((prev) => [
          {
            id: tempId,
            question_text: mc.listening,
            answer_json: {
              oneliner: mc.thinking,
              script: '',
              bullets: [],
              language: 'en',
              confidence: 'low',
            },
            detected_language: null,
            latency_ms: null,
            created_at: new Date().toISOString(),
            pending: true,
            streaming: true,
          },
          ...prev,
        ])

        const form = new FormData()
        form.set('sessionId', activeSession.id)
        form.set('audio', blob, 'capture.webm')
        const res = await fetch('/api/modules/meeting-copilot/capture', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || mc.errors.captureFailed)
        const answer = data.answer as CueAnswer
        const questionText = String(data.questionText ?? data.turn?.question_text ?? '')
        const turn = (data.turn as MeetingTurn) ?? {
          id: tempId,
          question_text: questionText,
          answer_json: answer,
          detected_language: answer.language,
          latency_ms: data.latencyMs ?? null,
          created_at: new Date().toISOString(),
        }
        setTurns((prev) => [
          {
            ...turn,
            id: tempId,
            target_answer: answer,
            answer_json: { ...answer, oneliner: '', script: '', bullets: [] },
            streaming: true,
          },
          ...prev.filter((tr) => tr.id !== tempId),
        ])
        startReveal(tempId, answer, true)
        setLiveTranscript('')
        return
      }

      const stt = liveSttRef.current
      const slice = sliceSttRef.current
      liveSttRef.current = null
      sliceSttRef.current = null
      let questionText = ''
      try {
        if (stt) questionText = (await stt.stop()).trim()
        else if (slice) questionText = (await slice.stop()).trim()
      } catch {
        questionText = ''
      }
      if (!questionText) questionText = liveTranscript.trim()

      if (questionText.length < 3) {
        setError(mc.errors.tooShort)
        setLiveTranscript('')
        return
      }

      setTurns((prev) => [
        {
          id: tempId,
          question_text: questionText,
          answer_json: {
            oneliner: mc.thinking,
            script: '',
            bullets: [],
            language: 'en',
            confidence: 'low',
          },
          detected_language: null,
          latency_ms: null,
          created_at: new Date().toISOString(),
          pending: true,
          streaming: true,
        },
        ...prev,
      ])

      await streamCueAnswer(activeSession.id, questionText, tempId)
      setLiveTranscript('')
      if (!liveTokenBlockedRef.current) {
        tokenRef.current = null
        void ensureToken().catch(() => {
          liveTokenBlockedRef.current = true
        })
      }
    } catch (err) {
      setTurns((prev) => prev.filter((tr) => tr.id !== tempId))
      const message = err instanceof Error ? err.message : mc.errors.captureFailed
      if (message === 'meeting_copilot_table_missing') setWarning(mc.warnings.tableMissing)
      else setError(message)
    } finally {
      setCapturing(false)
    }
  }, [activeSession, liveTranscript, mc])

  useEffect(() => {
    if (tab !== 'live') return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (isEditableTarget(e.target)) return
      if (e.repeat) return
      e.preventDefault()
      void startHold()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      void stopHoldAndCapture()
    }
    const onBlur = () => {
      if (holdingRef.current) void stopHoldAndCapture()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [tab, startHold, stopHoldAndCapture])

  useEffect(() => {
    return () => {
      clearTypewriter()
      abortStreamRef.current?.abort()
      liveSttRef.current?.abort()
      sliceSttRef.current?.abort()
      mediaRef.current?.getTracks().forEach((tr) => tr.stop())
      mediaRef.current = null
    }
  }, [])

  async function reindexDocs() {
    setReindexing(true)
    setError(null)
    try {
      const res = await fetch('/api/modules/meeting-copilot/docs/reindex', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'meeting_chunks_missing') setWarning(mc.warnings.chunksMissing)
        else setError(data.error ?? mc.errors.reindexFailed)
        return
      }
      setUploadProgress(mc.reindexDone.replace('{n}', String(data.chunks ?? 0)))
    } catch {
      setError(mc.errors.reindexFailed)
    } finally {
      setReindexing(false)
    }
  }

  async function seedAsherivBrief() {
    setSeeding(true)
    setError(null)
    try {
      const res = await fetch('/api/modules/meeting-copilot/docs/seed-asheriv', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'meeting_copilot_table_missing') setWarning(mc.warnings.tableMissing)
        else if (data.error === 'answer_template_type_missing') setWarning(mc.warnings.templateTypeMissing)
        else if (data.error === 'meeting_chunks_missing') setWarning(mc.warnings.chunksMissing)
        else setError(data.error ?? mc.errors.saveFailed)
        return
      }
      setUploadProgress(
        mc.seedAsherivDone
          .replace('{docs}', String(data.docs ?? 0))
          .replace('{chunks}', String(data.chunks ?? 0))
          .replace('{version}', String(data.version ?? '')),
      )
      await loadDocs()
    } catch {
      setError(mc.errors.saveFailed)
    } finally {
      setSeeding(false)
    }
  }

  const latest = turns[0] ?? null

  const cueCard = (turn: MeetingTurn, compact = false) => {
    const a = turn.answer_json
    const target = turn.target_answer
    return (
      <div
        key={turn.id}
        className={cn(
          'rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 p-4 backdrop-blur-md',
          turn.pending && 'opacity-80',
          compact && 'shadow-2xl border-[var(--accent)]/40',
        )}
      >
        <p className={cn('font-semibold leading-snug text-[var(--text)]', compact ? 'text-lg' : 'text-base')}>
          {a.oneliner || (turn.pending ? mc.thinking : '…')}
          {turn.streaming && <span className="ml-0.5 inline-block animate-pulse text-[var(--accent)]">▍</span>}
        </p>
        {a.script && a.script !== a.oneliner && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--text)]/90">{a.script}</p>
        )}
        {a.bullets?.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            {a.bullets.map((b, i) => (
              <li key={i} className="text-[var(--text)]/80">
                {b}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          {(target || !turn.pending) && (
            <>
              <span className="rounded bg-[var(--border)]/40 px-1.5 py-0.5 uppercase">
                {(target ?? a).language}
              </span>
              <span>{(target ?? a).confidence}</span>
              {turn.latency_ms != null && <span>{Math.round(turn.latency_ms / 100) / 10}s</span>}
              {turn.streaming && target && (
                <button
                  type="button"
                  className="underline decoration-[var(--accent)]/50 hover:text-[var(--accent)]"
                  onClick={() => revealAll(turn.id)}
                >
                  {mc.showAll}
                </button>
              )}
              <button
                type="button"
                className="underline decoration-[var(--accent)]/50 hover:text-[var(--accent)]"
                onClick={() => {
                  const src = target ?? a
                  const text = [src.oneliner, src.script, ...(src.bullets ?? []).map((b) => `• ${b}`)]
                    .filter(Boolean)
                    .join('\n')
                  void navigator.clipboard.writeText(text)
                }}
              >
                {mc.copy}
              </button>
            </>
          )}
        </div>
        {!compact && (
          <p className="mt-2 border-t border-[var(--border)]/40 pt-2 text-xs text-[var(--muted)]">
            Q: {turn.question_text}
          </p>
        )}
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pool', label: mc.tabs.pool },
    { id: 'brief', label: mc.tabs.brief },
    { id: 'live', label: mc.tabs.live },
  ]

  const body = (
    <div className={cn('mx-auto flex w-full flex-col gap-4', liveOnly ? 'max-w-5xl px-4 py-4' : 'max-w-3xl')}>
      {!liveOnly && (
        <div className="flex items-start gap-3">
          <ModuleGlyph moduleId="meeting-copilot" primary={mod.accent.primary} glow={mod.accent.glow} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
              {t.modules['meeting-copilot'].name}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{t.modules['meeting-copilot'].description}</p>
          </div>
        </div>
      )}

      {liveOnly && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text)]">{mc.liveTitle}</h1>
            <p className="text-sm text-[var(--muted)]">{mc.spaceHint}</p>
          </div>
          <Link href="/meeting-copilot" className="text-sm text-[var(--accent)] underline">
            {mc.backToPrep}
          </Link>
        </div>
      )}

      {!liveOnly && (
        <div className="flex flex-wrap gap-2">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={cn(
                'min-h-10 rounded-lg px-3 text-sm transition',
                tab === tb.id
                  ? 'bg-[var(--accent)] text-[var(--bg)]'
                  : 'border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]',
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>
      )}

      {warning && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {warning}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
      )}
      {micError && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {micError}
        </p>
      )}

      {loading && <p className="text-sm text-[var(--muted)]">{t.common.loading}</p>}

      {!loading && tab === 'pool' && !liveOnly && (
        <GlassPanel className="flex flex-col gap-4 p-4">
          <div>
            <h2 className="text-lg font-medium text-[var(--text)]">{mc.poolTitle}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{mc.poolHint}</p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files)
            }}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition',
              dragOver
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border)] bg-[var(--surface)]/40',
            )}
          >
            <p className="text-sm font-medium text-[var(--text)]">{mc.uploadTitle}</p>
            <p className="max-w-md text-xs text-[var(--muted)]">{mc.uploadHint}</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.pptx,.docx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files)
              }}
            />
            <Button
              type="button"
              className="min-h-11"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? mc.uploading : mc.uploadButton}
            </Button>
            {uploadProgress && <p className="text-xs text-[var(--muted)]">{uploadProgress}</p>}
            <Button
              type="button"
              variant="ghost"
              className="min-h-10 text-sm"
              disabled={reindexing || !docs.length}
              onClick={() => void reindexDocs()}
            >
              {reindexing ? mc.reindexing : mc.reindex}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-10 text-sm"
              disabled={seeding}
              onClick={() => void seedAsherivBrief()}
            >
              {seeding ? mc.seedingAsheriv : mc.seedAsheriv}
            </Button>
          </div>

          <details className="rounded-lg border border-[var(--border)]/60 p-3">
            <summary className="cursor-pointer text-sm text-[var(--muted)]">{mc.pasteToggle}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={labelClass}>{mc.docTitle}</span>
                <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mc.docTitlePlaceholder} />
              </label>
              <label className="block">
                <span className={labelClass}>{mc.docType}</span>
                <select className={fieldClass} value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
                  {DOC_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {mc.docTypes[d]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>{mc.tags}</span>
                <input className={fieldClass} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={mc.tagsPlaceholder} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>{mc.content}</span>
                <textarea
                  className={`${fieldClass} min-h-[10rem] resize-y`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={mc.contentPlaceholder}
                />
              </label>
            </div>
            <Button type="button" onClick={() => void addDoc()} disabled={savingDoc || !content.trim()} className="mt-3 min-h-12">
              {savingDoc ? mc.saving : mc.addDoc}
            </Button>
          </details>
          <div className="flex flex-col gap-2 border-t border-[var(--border)]/50 pt-3">
            <h3 className="text-sm font-medium text-[var(--muted)]">{mc.poolList}</h3>
            {docs.length === 0 && <p className="text-sm text-[var(--muted)]">{mc.emptyPool}</p>}
            {docs.map((d) => (
              <div key={d.id} className="flex items-start gap-2 rounded-lg border border-[var(--border)]/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text)]">{d.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {mc.docTypes[d.doc_type] ?? d.doc_type}
                    {d.tags?.length ? ` · ${d.tags.join(', ')}` : ''}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{d.content_text}</p>
                </div>
                <Button type="button" variant="ghost" className="min-h-10 shrink-0 px-2 text-sm text-red-300/80" onClick={() => void removeDoc(d.id)}>
                  {t.common.delete}
                </Button>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {!loading && tab === 'brief' && !liveOnly && (
        <GlassPanel className="flex flex-col gap-4 p-4">
          <div>
            <h2 className="text-lg font-medium text-[var(--text)]">{mc.briefTitle}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{mc.briefHint}</p>
          </div>
          <label className="block">
            <span className={labelClass}>{mc.counterparty}</span>
            <input className={fieldClass} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder={mc.counterpartyPlaceholder} />
          </label>
          <label className="block">
            <span className={labelClass}>{mc.focus}</span>
            <textarea className={`${fieldClass} min-h-[5rem] resize-y`} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder={mc.focusPlaceholder} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>{mc.languageMode}</span>
              <select className={fieldClass} value={languageMode} onChange={(e) => setLanguageMode(e.target.value as LanguageMode)}>
                <option value="auto">{mc.languages.auto}</option>
                <option value="tr">{mc.languages.tr}</option>
                <option value="en">{mc.languages.en}</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>{mc.tagFilter}</span>
              <input className={fieldClass} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder={mc.tagFilterPlaceholder} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void startSession()} disabled={starting} className="min-h-12 flex-1">
              {starting ? mc.starting : mc.startLive}
            </Button>
            <Link
              href="/meeting-copilot/live"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--border)] px-4 text-sm text-[var(--text)]"
            >
              {mc.openLiveWindow}
            </Link>
          </div>
          {sessions.length > 0 && (
            <div className="border-t border-[var(--border)]/50 pt-3">
              <h3 className="mb-2 text-sm font-medium text-[var(--muted)]">{mc.recentSessions}</h3>
              <div className="flex flex-col gap-2">
                {sessions.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setActiveSession(s)
                      setTab('live')
                    }}
                    className="rounded-lg border border-[var(--border)]/60 px-3 py-2 text-left text-sm hover:border-[var(--accent)]/40"
                  >
                    <span className="font-medium text-[var(--text)]">{s.counterparty || mc.untitledSession}</span>
                    <span className="ml-2 text-xs text-[var(--muted)]">{s.status}</span>
                    {s.focus && <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)]">{s.focus}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </GlassPanel>
      )}

      {!loading && tab === 'live' && (
        <div className={cn('flex flex-col gap-4', cornerMode && !liveOnly && 'min-h-[40vh]')}>
          <GlassPanel className={cn('flex flex-col gap-3 p-4', cornerMode && 'opacity-80')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium text-[var(--text)]">{mc.liveTitle}</h2>
                {activeSession ? (
                  <p className="text-sm text-[var(--muted)]">
                    {activeSession.counterparty || mc.untitledSession}
                    {activeSession.focus ? ` · ${activeSession.focus}` : ''}
                  </p>
                ) : (
                  <p className="text-sm text-amber-200/90">{mc.needSession}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={cornerMode}
                    onChange={(e) => setCornerMode(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {mc.cornerMode}
                </label>
                {activeSession?.status === 'active' && (
                  <Button type="button" variant="ghost" className="min-h-10" onClick={() => void endSession()}>
                    {mc.endSession}
                  </Button>
                )}
                {!activeSession && (
                  <Button type="button" className="min-h-10" onClick={() => setTab('brief')}>
                    {mc.goBrief}
                  </Button>
                )}
              </div>
            </div>

            <div
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-8',
                holding && 'border-[var(--accent)] bg-[var(--accent)]/10',
                capturing && 'opacity-80',
              )}
            >
              <div
                className={cn(
                  'flex h-20 w-20 items-center justify-center rounded-full border-2 text-sm font-semibold',
                  holding ? 'border-[var(--accent)] text-[var(--accent)] animate-pulse' : 'border-[var(--border)] text-[var(--muted)]',
                )}
              >
                {holding ? mc.recording : capturing ? '…' : 'Space'}
              </div>
              <p className="max-w-sm text-center text-sm text-[var(--muted)]">{mc.spaceHint}</p>
              {(holding || liveTranscript) && (
                <p className="max-w-lg px-4 text-center text-base leading-relaxed text-[var(--text)]">
                  {liveTranscript || mc.listeningLive}
                </p>
              )}
              <p className="text-xs text-[var(--muted)]">
                {tokenReady ? mc.micReady : mc.micWarming}
              </p>
              <button
                type="button"
                disabled={!activeSession || capturing}
                onPointerDown={(e) => {
                  e.preventDefault()
                  void startHold()
                }}
                onPointerUp={(e) => {
                  e.preventDefault()
                  void stopHoldAndCapture()
                }}
                onPointerLeave={() => {
                  if (holdingRef.current) void stopHoldAndCapture()
                }}
                className="mt-1 min-h-11 rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-[var(--bg)] disabled:opacity-40"
              >
                {mc.holdToCapture}
              </button>
            </div>

            {!cornerMode && (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-[var(--muted)]">{mc.questions}</h3>
                  {turns.length === 0 && <p className="text-sm text-[var(--muted)]">{mc.emptyTurns}</p>}
                  {turns.map((tr) => (
                    <div key={tr.id} className="rounded-lg border border-[var(--border)]/50 px-3 py-2 text-sm text-[var(--text)]">
                      {tr.question_text}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium text-[var(--muted)]">{mc.cues}</h3>
                  {turns.length === 0 && <p className="text-sm text-[var(--muted)]">{mc.emptyTurns}</p>}
                  {turns.map((tr) => cueCard(tr))}
                </div>
              </div>
            )}
          </GlassPanel>

          {cornerMode && latest && (
            <div className="pointer-events-auto fixed bottom-4 right-4 z-[80] w-[min(24rem,calc(100vw-2rem))]">
              {cueCard(latest, true)}
              {holding && (
                <p className="mt-2 text-center text-xs font-medium text-[var(--accent)]">{mc.recording}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )

  if (liveOnly) {
    return (
      <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
        {body}
        {cornerMode && latest && tab === 'live' ? null : null}
      </div>
    )
  }

  return <ShellLayout>{body}</ShellLayout>
}
