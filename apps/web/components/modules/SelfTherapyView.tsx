'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'

interface TherapySession {
  id: string
  title: string
  topic: string
  locale: string
  induction: string
  deepening: string
  suggestions: string
  full_script: string
  audio_path: string | null
  duration_seconds: number | null
  status: string
  created_at: string
}

type DurationHint = 'short' | 'medium' | 'long'

function buildSpokenScript(inductionText: string, deepeningText: string, suggestionsText: string) {
  return [inductionText, deepeningText, suggestionsText]
    .map((s) => s.replace(/…/g, '.').trim())
    .filter(Boolean)
    .join('\n\n')
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SelfTherapyView() {
  const { t, locale } = useLocale()
  const st = t.selfTherapy
  const mod = getModuleById('self-therapy')!

  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [durationHint, setDurationHint] = useState<DurationHint>('medium')
  const [sessions, setSessions] = useState<TherapySession[]>([])
  const [active, setActive] = useState<TherapySession | null>(null)
  const [induction, setInduction] = useState('')
  const [deepening, setDeepening] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [speakProgress, setSpeakProgress] = useState<number | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [sleepMode, setSleepMode] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [fadeMinutes, setFadeMinutes] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoplayAfterSpeakRef = useRef(false)

  const applySession = useCallback((s: TherapySession | null) => {
    setActive(s)
    setInduction(s?.induction ?? '')
    setDeepening(s?.deepening ?? '')
    setSuggestions(s?.suggestions ?? '')
    setAudioUrl(null)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/modules/self-therapy')
    const data = await res.json()
    if (data.warning === 'self_therapy_table_missing') {
      setWarning(st.warnings.tableMissing)
    }
    if (res.ok) {
      const items = (data.items ?? []) as TherapySession[]
      setSessions(items)
      setActive((prev) => {
        if (prev) return prev
        const first = items[0]
        if (first) {
          setInduction(first.induction)
          setDeepening(first.deepening)
          setSuggestions(first.suggestions)
          return first
        }
        return null
      })
    } else {
      setError(data.error ?? st.errors.loadFailed)
    }
    setLoading(false)
  }, [st.warnings.tableMissing, st.errors.loadFailed])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!active?.audio_path || audioUrl) return
    void (async () => {
      const res = await fetch(`/api/modules/self-therapy/audio?id=${active.id}`)
      const data = await res.json()
      if (res.ok && data.audioUrl) setAudioUrl(data.audioUrl)
    })()
  }, [active, audioUrl])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setCurrentTime(el.currentTime)
    const onMeta = () => setDuration(el.duration || 0)
    const onEnded = () => {
      setPlaying(false)
      setSleepMode(false)
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('ended', onEnded)
    }
  }, [audioUrl])

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

  async function generate() {
    if (!topic.trim()) return
    setGenerating(true)
    setError(null)
    const res = await fetch('/api/modules/self-therapy/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic.trim(), notes: notes.trim() || undefined, locale, durationHint }),
    })
    const data = await res.json()
    setGenerating(false)
    if (!res.ok) {
      setError(data.error ?? st.errors.generateFailed)
      return
    }
    if (data.warning === 'self_therapy_table_missing') {
      setWarning(st.warnings.tableMissing)
      if (data.script) {
        applySession({
          id: 'preview',
          title: data.script.title,
          topic: topic.trim(),
          locale,
          induction: data.script.induction,
          deepening: data.script.deepening,
          suggestions: data.script.suggestions,
          full_script: data.script.fullScript,
          audio_path: null,
          duration_seconds: null,
          status: 'draft',
          created_at: new Date().toISOString(),
        })
      }
      return
    }
    if (data.item) {
      applySession(data.item)
      setSessions((prev) => [data.item, ...prev.filter((s) => s.id !== data.item.id)])
      setTopic('')
      setNotes('')
    }
  }

  async function speak() {
    if (!active || active.id === 'preview') {
      setError(st.errors.tableRequired)
      return
    }
    setSpeaking(true)
    setSpeakProgress(0)
    setError(null)
    setAudioUrl(null)
    try {
      const localBase = (
        process.env.NEXT_PUBLIC_LOCAL_TTS_URL ||
        (process.env.NEXT_PUBLIC_TTS_PROVIDER === 'local' ? 'http://127.0.0.1:8765' : '')
      ).replace(/\/$/, '')

      let res: Response
      if (localBase) {
        const fullScript = buildSpokenScript(induction, deepening, suggestions)
        if (!fullScript.trim()) {
          setError(st.errors.speakFailed)
          return
        }
        if (!deepening.trim() || !suggestions.trim()) {
          setWarning(st.warnings.incompleteScript)
        }
        const start = await fetch(`${localBase}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: fullScript,
            language: locale || 'tr',
            ref: process.env.NEXT_PUBLIC_LOCAL_VOICE_REF || 'ref_1.wav',
          }),
        })
        if (!start.ok) {
          const detail = await start.text()
          throw new Error(
            start.status === 0 || /Failed to fetch/i.test(detail)
              ? st.errors.localTtsUnavailable
              : `Local TTS: ${detail.slice(0, 200)}`,
          )
        }
        const { id: jobId } = (await start.json()) as { id: string }
        let progress = 0
        for (;;) {
          await new Promise((r) => setTimeout(r, 800))
          const stRes = await fetch(`${localBase}/jobs/${jobId}`)
          if (!stRes.ok) throw new Error(st.errors.localTtsUnavailable)
          const job = (await stRes.json()) as {
            status: string
            progress: number
            error?: string | null
          }
          progress = Math.max(progress, job.progress ?? 0)
          setSpeakProgress(progress)
          if (job.status === 'done') break
          if (job.status === 'error') {
            throw new Error(job.error || st.errors.speakFailed)
          }
        }
        setSpeakProgress(100)
        const audioRes = await fetch(`${localBase}/jobs/${jobId}/audio`)
        if (!audioRes.ok) throw new Error(st.errors.speakFailed)
        const blob = await audioRes.blob()
        const form = new FormData()
        form.set('sessionId', active.id)
        form.set('induction', induction)
        form.set('deepening', deepening)
        form.set('suggestions', suggestions)
        form.set('audio', blob, 'speak.wav')
        res = await fetch('/api/modules/self-therapy/speak', { method: 'POST', body: form })
      } else {
        res = await fetch('/api/modules/self-therapy/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: active.id,
            induction,
            deepening,
            suggestions,
          }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'ELEVENLABS_API_KEY missing') {
          setError(st.errors.noElevenLabsKey)
        } else if (data.error === 'ELEVENLABS_PAID_VOICE') {
          setError(st.errors.paidVoiceRequired)
        } else if (data.error === 'ELEVENLABS_QUOTA') {
          setError(st.errors.elevenLabsQuota)
        } else if (data.error === 'LOCAL_TTS_UNAVAILABLE') {
          setError(st.errors.localTtsUnavailable)
        } else if (data.error === 'self_therapy_storage_missing') {
          setWarning(st.warnings.storageMissing)
          setError(st.errors.storageMissing)
        } else {
          setError(data.error ?? st.errors.speakFailed)
        }
        return
      }
      if (data.item) {
        setActive(data.item)
        setInduction(data.item.induction)
        setDeepening(data.item.deepening)
        setSuggestions(data.item.suggestions)
        setSessions((prev) => prev.map((s) => (s.id === data.item.id ? data.item : s)))
      }
      const url = data.audioUrl as string | null
      if (!url) {
        setError(st.errors.speakFailed)
        return
      }
      autoplayAfterSpeakRef.current = true
      setAudioUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : st.errors.speakFailed)
    } finally {
      setSpeaking(false)
      setSpeakProgress(null)
    }
  }

  // After speak sets audioUrl, <audio> mounts — then play once
  useEffect(() => {
    if (!audioUrl || speaking || !autoplayAfterSpeakRef.current) return
    autoplayAfterSpeakRef.current = false
    const el = audioRef.current
    if (!el) return
    el.load()
    void el.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    )
  }, [audioUrl, speaking])

  async function removeSession(id: string) {
    if (id === 'preview') {
      applySession(null)
      return
    }
    await fetch(`/api/modules/self-therapy?id=${id}`, { method: 'DELETE' })
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (active?.id === id) applySession(null)
  }

  function togglePlay() {
    const el = audioRef.current
    if (!el || !audioUrl) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      void el.play()
      setPlaying(true)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: active?.title ?? st.title,
          artist: 'asliCo Self Therapy',
        })
      }
    }
  }

  function enterSleep() {
    setSleepMode(true)
    const el = audioRef.current
    if (el && audioUrl && !playing) {
      void el.play()
      setPlaying(true)
    }
    if (fadeMinutes > 0) {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = setTimeout(() => {
        const a = audioRef.current
        if (!a) return
        const start = a.volume
        const steps = 20
        let i = 0
        const iv = setInterval(() => {
          i += 1
          a.volume = Math.max(0, start * (1 - i / steps))
          if (i >= steps) {
            clearInterval(iv)
            a.pause()
            a.volume = 1
            setPlaying(false)
            setSleepMode(false)
          }
        }, 250)
      }, fadeMinutes * 60 * 1000)
    }
  }

  function exitSleep() {
    setSleepMode(false)
  }

  const fieldClass =
    'w-full min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40'
  const labelClass = 'mb-1.5 block text-sm font-medium text-[var(--muted)]'

  return (
    <ShellLayout>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-1">
        <header className="flex items-start gap-4">
          <ModuleGlyph moduleId="self-therapy" primary={mod.accent.primary} glow={mod.accent.glow} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              {t.modules['self-therapy'].name}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{t.modules['self-therapy'].description}</p>
          </div>
        </header>

        <p className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface)]/50 px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
          {st.disclaimer}
        </p>

        {warning && (
          <GlassPanel className="border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
            {warning}
          </GlassPanel>
        )}
        {error && (
          <GlassPanel className="border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">{error}</GlassPanel>
        )}

        <GlassPanel className="flex flex-col gap-4 p-4">
          <div>
            <label className={labelClass} htmlFor="st-topic">
              {st.topicLabel}
            </label>
            <input
              id="st-topic"
              className={fieldClass}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={st.topicPlaceholder}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="st-notes">
              {st.notesLabel}
            </label>
            <textarea
              id="st-notes"
              className={`${fieldClass} min-h-[4.5rem] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={st.notesPlaceholder}
            />
          </div>
          <div>
            <span className={labelClass}>{st.durationLabel}</span>
            <div className="flex flex-wrap gap-2">
              {(['short', 'medium', 'long'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationHint(d)}
                  className={`min-h-11 min-w-[4.5rem] rounded-lg px-3 text-sm transition ${
                    durationHint === d
                      ? 'bg-[var(--accent)] text-[var(--bg)]'
                      : 'border border-[var(--border)] text-[var(--text)]'
                  }`}
                >
                  {st.durations[d]}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={() => void generate()}
            disabled={generating || !topic.trim()}
            className="min-h-12 w-full text-base"
          >
            {generating ? st.generating : st.generate}
          </Button>
        </GlassPanel>

        {active && (
          <GlassPanel className="flex flex-col gap-4 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">{active.title}</h2>
                <p className="text-xs text-[var(--muted)]">{active.topic}</p>
              </div>
              <span className="shrink-0 rounded-md border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
                {st.status[active.status as keyof typeof st.status] ?? active.status}
              </span>
            </div>

            {(
              [
                ['induction', induction, setInduction, st.sections.induction],
                ['deepening', deepening, setDeepening, st.sections.deepening],
                ['suggestions', suggestions, setSuggestions, st.sections.suggestions],
              ] as const
            ).map(([key, value, setter, label]) => (
              <div key={key}>
                <label className={labelClass} htmlFor={`st-${key}`}>
                  {label}
                </label>
                <textarea
                  id={`st-${key}`}
                  className={`${fieldClass} min-h-[7rem] resize-y text-[0.95rem] leading-relaxed`}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                />
              </div>
            ))}

            <Button
              onClick={() => void speak()}
              disabled={speaking || !buildSpokenScript(induction, deepening, suggestions)}
              className="min-h-12 w-full text-base"
            >
              {speaking ? st.speaking : st.speak}
            </Button>
            {(!deepening.trim() || !suggestions.trim()) && induction.trim() && !speaking && (
              <p className="text-center text-xs text-amber-200/80">{st.warnings.incompleteScript}</p>
            )}
            {speaking && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                  <span>{st.speakingHint}</span>
                  <span className="tabular-nums font-medium text-[var(--text)]">
                    {speakProgress == null ? '…' : `${Math.min(100, Math.round(speakProgress))}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]/60">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
                    style={{
                      width: `${speakProgress == null ? 8 : Math.max(4, Math.min(100, speakProgress))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {audioUrl && (
              <div className="flex flex-col gap-3 border-t border-[var(--border)]/50 pt-4">
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  preload="auto"
                  onError={() => setError(st.errors.audioPlayFailed)}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xl font-bold text-[var(--bg)]"
                    aria-label={playing ? st.pause : st.play}
                  >
                    {playing ? '❚❚' : '▶'}
                  </button>
                  <div className="min-w-0 flex-1">
                    <input
                      type="range"
                      min={0}
                      max={duration || 1}
                      step={0.1}
                      value={currentTime}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (audioRef.current) audioRef.current.currentTime = v
                        setCurrentTime(v)
                      }}
                      className="w-full accent-[var(--accent)]"
                    />
                    <div className="mt-0.5 flex justify-between text-xs text-[var(--muted)]">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration || active.duration_seconds || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm text-[var(--muted)]">{st.fadeTimer}</label>
                  <select
                    className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]"
                    value={fadeMinutes}
                    onChange={(e) => setFadeMinutes(Number(e.target.value))}
                  >
                    <option value={0}>{st.fadeOff}</option>
                    <option value={15}>15 {st.minutes}</option>
                    <option value={30}>30 {st.minutes}</option>
                    <option value={45}>45 {st.minutes}</option>
                    <option value={60}>60 {st.minutes}</option>
                  </select>
                  <Button type="button" onClick={enterSleep} className="min-h-11 flex-1 sm:flex-none">
                    {st.sleepMode}
                  </Button>
                </div>
              </div>
            )}
          </GlassPanel>
        )}

        <section>
          <h2 className="mb-2 text-sm font-medium text-[var(--muted)]">{st.history}</h2>
          {loading ? (
            <p className="text-sm text-[var(--muted)]">{t.common.loading}</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{st.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <GlassPanel className="flex items-center gap-2 p-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => applySession(s)}
                    >
                      <div className="truncate font-medium text-[var(--text)]">{s.title}</div>
                      <div className="truncate text-xs text-[var(--muted)]">{s.topic}</div>
                    </button>
                    <button
                      type="button"
                      className="min-h-10 shrink-0 px-2 text-sm text-red-300/80"
                      onClick={() => void removeSession(s.id)}
                    >
                      {t.common.delete}
                    </button>
                  </GlassPanel>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
          {t.common.backToDashboard}
        </Link>
      </div>

      {sleepMode && (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/95 px-6"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
          onClick={exitSleep}
          onKeyDown={(e) => e.key === 'Escape' && exitSleep()}
          role="button"
          tabIndex={0}
        >
          <p className="mb-8 max-w-xs text-center text-sm text-white/40">{st.sleepHint}</p>
          <button
            type="button"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-3xl text-white"
            onClick={(e) => {
              e.stopPropagation()
              togglePlay()
            }}
            aria-label={playing ? st.pause : st.play}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <p className="mt-6 text-sm text-white/50">{active?.title}</p>
          <p className="mt-2 text-xs text-white/30">{formatTime(currentTime)}</p>
        </div>
      )}
    </ShellLayout>
  )
}
