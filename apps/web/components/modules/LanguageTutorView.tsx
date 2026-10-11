'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button, cn } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { LessonMarkdown } from '@/components/modules/LessonMarkdown'
import { getModuleById } from '@/lib/module-registry'
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
} from '@/lib/voice/speech'

type Tab = 'today' | 'chat' | 'flashcards' | 'immersion' | 'report'
type ChatMode = 'friend' | 'pronunciation' | 'voice_coach' | 'grammar'
type Phase = 'teach' | 'practice' | 'check' | 'feedback' | 'missions'

interface LessonSections {
  teaching?: {
    goals?: string[]
    explanationMd?: string
    keyPatterns?: string[]
    commonMistakes?: string[]
  }
  words?: Array<{ word: string; translation: string; ipa?: string; example: string }>
  grammarRules?: Array<{ rule: string; explanation: string; examples: string[] }>
  drills?: Array<{ type: string; prompt: string; answer: string; hint?: string }>
  dialogues?: Array<{ context: string; lines: string[] }>
  reading?: { title: string; text: string; questions: string[] }
  speakingExercise?: { prompt: string; hints?: string[] }
  writingExercise?: { prompt: string; minSentences?: number }
  quiz?: Array<{ question: string; options?: string[]; answer: string }>
  dailyPlan?: {
    flashcardCount?: number
    coachMode?: ChatMode
    coachPrompt?: string
    immersionTask?: string
    videoTask?: string
    estimatedMinutes?: number
  }
  youtubeUrl?: string
  immersion?: { films: string[]; books: string[]; why: string }
  unitId?: string
  checkAcknowledged?: boolean
  submissions?: {
    quizScore?: number
    speaking?: string
    writing?: string
    feedback?: string
    quizAnswers?: Record<string, string>
  }
}

interface Lesson {
  id: string
  language: string
  topic: string
  status: string
  lesson_date?: string
  scores?: { quiz?: number } | null
  sections?: LessonSections
  youtube_url?: string
}

function localCalendarDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeQuizAnswer(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')
}

function scoreQuiz(
  quiz: Array<{ question: string; options?: string[]; answer: string }>,
  answers: Record<number, string>,
): number {
  if (!quiz.length) return 80
  let correct = 0
  for (let i = 0; i < quiz.length; i++) {
    const expected = normalizeQuizAnswer(quiz[i].answer ?? '')
    const given = normalizeQuizAnswer(answers[i] ?? '')
    if (expected && given && (given === expected || expected.includes(given) || given.includes(expected))) {
      correct += 1
    }
  }
  return Math.round((correct / quiz.length) * 100)
}

interface Flashcard {
  id: string
  language: string
  word: string
  translation: string
  ipa?: string
  example_sentence?: string
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

function fillTemplate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template,
  )
}

export function LanguageTutorView() {
  const { t, locale } = useLocale()
  const lt = t.languageTutor
  const mod = getModuleById('language-tutor')!
  const bottomRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<Tab>('today')
  const [phase, setPhase] = useState<Phase>('teach')
  const [teachDone, setTeachDone] = useState(false)
  const [practiceDone, setPracticeDone] = useState(false)
  const [revealedDrills, setRevealedDrills] = useState<Set<number>>(new Set())
  const [schedule, setSchedule] = useState<{
    language: string | null
    languageLabel: string | null
    isRestDay: boolean
    programDay: number
    languageDay?: number
    goalDays: number
    streak: number
    currentUnit?: { id: string; topic: string; grammarFocus: string; repeatUnit?: boolean } | null
    grammarMastery?: { topic_id: string; mastery_score: number; passed: boolean } | null
    grammarGateOpen?: boolean
    checkComplete?: boolean
    checkAcknowledged?: boolean
    quizPassThreshold?: number
  } | null>(null)
  const [progress, setProgress] = useState<{
    completedCount: number
    goalDays: number
    completedByLanguage: Record<string, number>
    unitsPassed: number
    unitsTotal: number
    languageDay: number
    lastQuizScore: number | null
    recentDone: Array<{ date: string; language: string; topic: string; quiz: number | null }>
  } | null>(null)
  const [immersion, setImmersion] = useState<{
    films: string[]
    books: string[]
    doneFilms?: string[]
    doneBooks?: string[]
    cultureBooks: Array<{ title: string; author: string | null; status: string }>
    youtubeUrl: string | null
    why: string
    cefr: string
  } | null>(null)
  const [generatingCards, setGeneratingCards] = useState(false)
  const recognitionRef = useRef<{
    stop: () => void
    abort: () => void
  } | null>(null)
  const micBaseRef = useRef('')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [dueCards, setDueCards] = useState<Flashcard[]>([])
  const [topErrors, setTopErrors] = useState<Array<{ mistake: string; correction: string; count: number }>>([])
  const [report, setReport] = useState<{ content_md: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [chatMode, setChatMode] = useState<ChatMode>('friend')
  const [chatLang, setChatLang] = useState('fr')
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [listening, setListening] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [revealedQuiz, setRevealedQuiz] = useState<Set<number>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [programStart, setProgramStart] = useState('')
  const [goalDays, setGoalDays] = useState(90)
  const [nativeLanguage, setNativeLanguage] = useState('tr')
  const [sundayBreak, setSundayBreak] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [speakingAnswer, setSpeakingAnswer] = useState('')
  const [writingAnswer, setWritingAnswer] = useState('')
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [rotation, setRotation] = useState('fr,es,ar')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/modules/language-tutor?local_date=${localCalendarDate()}`)
    const data = await res.json()
    if (data.warning === 'language_tutor_table_missing') setWarning(lt.warnings.tableMissing)
    if (res.ok) {
      setSchedule(data.schedule)
      setProgress(data.progress ?? null)
      setLesson(data.todayLesson)
      setDueCards(data.dueFlashcards ?? [])
      setTopErrors(data.topErrors ?? [])
      setReport(data.latestReport)
      if (data.schedule?.language) setChatLang(data.schedule.language)
      if (data.settings?.programStartDate) setProgramStart(data.settings.programStartDate)
      if (data.settings?.goalDays) setGoalDays(data.settings.goalDays)
      if (data.settings?.nativeLanguage) setNativeLanguage(data.settings.nativeLanguage)
      if (data.settings?.sundayBreak != null) setSundayBreak(data.settings.sundayBreak)
      if (data.settings?.rotation?.length) setRotation(data.settings.rotation.join(','))
      if (data.todayLesson?.scores?.quiz != null || data.schedule?.checkComplete) {
        setTeachDone(true)
        setPracticeDone(true)
        const subs = data.todayLesson?.sections?.submissions as
          | {
              quizAnswers?: Record<string, string>
              speaking?: string
              writing?: string
              feedback?: string
            }
          | undefined
        if (subs?.quizAnswers && typeof subs.quizAnswers === 'object') {
          const restored: Record<number, string> = {}
          for (const [k, v] of Object.entries(subs.quizAnswers)) {
            restored[Number(k)] = String(v)
          }
          setQuizAnswers(restored)
        }
        if (typeof subs?.speaking === 'string') setSpeakingAnswer(subs.speaking)
        if (typeof subs?.writing === 'string') setWritingAnswer(subs.writing)
        if (typeof subs?.feedback === 'string') setFeedback(subs.feedback)
        const ack =
          data.schedule?.checkAcknowledged ||
          data.todayLesson?.sections?.checkAcknowledged === true
        setPhase(ack ? 'missions' : 'feedback')
      }
    }
    const immRes = await fetch('/api/modules/language-tutor/immersion')
    const immData = await immRes.json()
    if (immRes.ok && !immData.restDay) setImmersion(immData)
    setLoading(false)
  }, [lt.warnings.tableMissing])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatSending])

  async function generateLesson(force = false) {
    setGenerating(true)
    setError(null)
    setTeachDone(false)
    setPracticeDone(false)
    setPhase('teach')
    setQuizAnswers({})
    setRevealedQuiz(new Set())
    setRevealedDrills(new Set())
    setFeedback(null)
    setSpeakingAnswer('')
    setWritingAnswer('')
    try {
      const res = await fetch('/api/modules/language-tutor/lesson/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          force,
          lesson_date: localCalendarDate(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? data.message ?? lt.errors.lessonFailed)
        await load()
        return
      }
      if (data.restDay) {
        setError(lt.restDay)
        return
      }
      if (data.lesson) setLesson(data.lesson)
      await load()
    } catch {
      setError(lt.errors.lessonFailed)
      await load()
    } finally {
      setGenerating(false)
    }
  }

  async function deleteTodayLesson() {
    setGenerating(true)
    setError(null)
    const date = lesson?.lesson_date ?? localCalendarDate()
    const res = await fetch(`/api/modules/language-tutor/lesson?lesson_date=${date}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    setGenerating(false)
    if (!res.ok) {
      setError(data.error ?? data.message ?? lt.errors.lessonFailed)
      return
    }
    setLesson(null)
    setTeachDone(false)
    setPracticeDone(false)
    setPhase('teach')
    setFeedback(null)
    await load()
  }

  async function submitPractice() {
    if (!lesson?.id) {
      setError(lt.errors.submitFailed)
      return
    }
    setSubmitting(true)
    setError(null)
    const quizScore = scoreQuiz(sections?.quiz ?? [], quizAnswers)
    const quizAnswersPayload: Record<string, string> = {}
    for (const [k, v] of Object.entries(quizAnswers)) {
      quizAnswersPayload[String(k)] = v
    }
    const res = await fetch('/api/modules/language-tutor/lesson/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lesson_id: lesson.id,
        lesson_date: lesson.lesson_date ?? localCalendarDate(),
        speaking: speakingAnswer,
        writing: writingAnswer,
        quiz_score: quizScore,
        quiz_answers: quizAnswersPayload,
        locale: nativeLanguage,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error ?? lt.errors.submitFailed)
      return
    }
    setFeedback(data.feedback)
    setPracticeDone(true)
    setLesson((prev) =>
      prev ?
        {
          ...prev,
          ...(data.lesson ?? {}),
          scores: data.scores ?? { ...(prev.scores ?? {}), quiz: quizScore },
          status: data.lesson?.status ?? 'in_progress',
          sections: {
            ...(prev.sections ?? {}),
            ...(data.lesson?.sections ?? {}),
            checkAcknowledged: false,
          },
        }
      : prev,
    )
    setPhase('feedback')
    await load()
  }

  function retakeCheck() {
    setError(null)
    setFeedback(null)
    setQuizAnswers({})
    setRevealedQuiz(new Set())
    setPhase('check')
  }

  async function acknowledgeCheck() {
    if (!lesson?.id) return
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/modules/language-tutor/lesson/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lesson_id: lesson.id,
        lesson_date: lesson.lesson_date ?? localCalendarDate(),
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.message ?? data.error ?? lt.errors.submitFailed)
      return
    }
    setLesson((prev) =>
      prev ?
        {
          ...prev,
          ...(data.lesson ?? {}),
          sections: {
            ...(prev.sections ?? {}),
            ...(data.lesson?.sections ?? {}),
            checkAcknowledged: true,
          },
        }
      : prev,
    )
    setPhase('missions')
    await load()
  }

  async function completeLesson() {
    if (!lesson?.id) {
      setError(lt.errors.lessonFailed)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/modules/language-tutor/lesson/complete', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id: lesson.id,
          lesson_date: lesson.lesson_date ?? localCalendarDate(),
          unit_id: lesson.sections?.unitId ?? schedule?.currentUnit?.id,
          acknowledged: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message ?? data.error ?? lt.errors.grammarBlocked)
        return
      }
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function sendChat(text: string) {
    const trimmed = text.trim()
    if (!trimmed || chatSending) return
    setChatSending(true)
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    const res = await fetch('/api/modules/language-tutor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed, mode: chatMode, language: chatLang, locale }),
    })
    const data = await res.json()
    setChatSending(false)
    if (res.ok) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      if (data.grammarMastery?.passed) await load()
      if (chatMode === 'voice_coach' && isSpeechSynthesisSupported()) {
        speakText(data.reply.split('\n')[0] ?? data.reply, chatLang)
      }
    } else {
      setError(data.error)
    }
  }

  async function reviewCard(quality: number) {
    const card = dueCards[cardIndex]
    if (!card) return
    await fetch('/api/modules/language-tutor/flashcards/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: card.id, quality }),
    })
    setShowAnswer(false)
    setCardIndex((i) => i + 1)
    if (cardIndex + 1 >= dueCards.length) await load()
  }

  async function genReport() {
    const res = await fetch('/api/modules/language-tutor/report', { method: 'POST' })
    const data = await res.json()
    if (res.ok) setReport(data.report)
  }

  async function saveSettings() {
    setSavingSettings(true)
    await fetch('/api/modules/language-tutor/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program_start_date: programStart,
        goal_days: goalDays,
        native_language: nativeLanguage,
        sunday_break: sundayBreak,
        rotation: rotation.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    })
    setSavingSettings(false)
    await load()
  }

  function stopMic() {
    try {
      recognitionRef.current?.stop()
    } catch {
      try {
        recognitionRef.current?.abort()
      } catch {
        // ignore
      }
    }
    recognitionRef.current = null
    setListening(false)
  }

  function toggleMic() {
    if (listening) {
      stopMic()
      return
    }
    const rec = createSpeechRecognition(chatLang, { continuous: true, interimResults: true })
    if (!rec) return
    micBaseRef.current = chatInput.trim()
    let finals = ''
    recognitionRef.current = rec
    setListening(true)
    rec.onresult = (ev) => {
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i]?.[0]?.transcript ?? ''
        if (ev.results[i]?.isFinal) finals += (finals ? ' ' : '') + piece.trim()
        else interim += piece
      }
      const base = micBaseRef.current
      const merged = [base, finals, interim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
      setChatInput(merged)
    }
    rec.onerror = () => {
      recognitionRef.current = null
      setListening(false)
    }
    // Only clear listening if WE stopped — continuous mode may fire onend between phrases.
    rec.onend = () => {
      if (recognitionRef.current === rec) {
        // Browser ended early — restart while user still wants listening
        try {
          rec.start()
        } catch {
          recognitionRef.current = null
          setListening(false)
        }
      }
    }
    try {
      rec.start()
    } catch {
      setListening(false)
      recognitionRef.current = null
    }
  }

  async function markImmersionDone(kind: 'film' | 'book', title: string) {
    const language = (schedule?.language ?? lesson?.language ?? 'fr') as string
    const res = await fetch('/api/modules/language-tutor/immersion/done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, kind, title }),
    })
    const data = await res.json().catch(() => ({}))
    // Always refresh active list from API (or optimistic local filter)
    if (data.done || res.ok) {
      const immRes = await fetch('/api/modules/language-tutor/immersion')
      const imm = await immRes.json()
      if (immRes.ok && !imm.restDay) setImmersion(imm)
    } else {
      setImmersion((prev) => {
        if (!prev) return prev
        if (kind === 'film') {
          return {
            ...prev,
            films: prev.films.filter((f) => f !== title),
            doneFilms: [...(prev.doneFilms ?? []), title],
          }
        }
        return {
          ...prev,
          books: prev.books.filter((b) => b !== title),
          doneBooks: [...(prev.doneBooks ?? []), title],
        }
      })
    }
  }

  async function generateNewFlashcards() {
    const language = schedule?.language ?? lesson?.language ?? chatLang
    setGeneratingCards(true)
    setError(null)
    const res = await fetch('/api/modules/language-tutor/flashcards/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, count: 15 }),
    })
    const data = await res.json().catch(() => ({}))
    setGeneratingCards(false)
    if (!res.ok) {
      setError(data.error ?? lt.errors.lessonFailed)
      return
    }
    setCardIndex(0)
    setShowAnswer(false)
    await load()
    setTab('flashcards')
  }

  function openCoachMission() {
    const plan = sections?.dailyPlan
    if (plan?.coachMode) setChatMode(plan.coachMode)
    if (plan?.coachPrompt) setChatInput(plan.coachPrompt)
    setTab('chat')
  }

  const sections = lesson?.sections
  const currentCard = dueCards[cardIndex]
  const isArabic = lesson?.language === 'ar' || chatLang === 'ar'
  const textDir = isArabic ? 'rtl' : 'ltr'
  const hasTeaching = Boolean(sections?.teaching?.explanationMd)
  const checkComplete =
    schedule?.checkComplete || typeof lesson?.scores?.quiz === 'number'
  const checkAcknowledged =
    schedule?.checkAcknowledged === true || sections?.checkAcknowledged === true
  /** Day can always be marked done once a lesson row exists (no quiz soft-lock). */
  const canComplete = Boolean(lesson?.id)
  const estimated = sections?.dailyPlan?.estimatedMinutes ?? 45
  const passThreshold = schedule?.quizPassThreshold ?? 70
  const quizScoreNow = lesson?.scores?.quiz

  const checklist = useMemo(() => {
    const items = [
      { id: 'teach', label: lt.phaseTeach, done: teachDone || checkComplete },
      { id: 'practice', label: lt.phasePractice, done: practiceDone || checkComplete },
      { id: 'check', label: lt.phaseCheck, done: checkComplete },
      { id: 'feedback', label: lt.phaseFeedback, done: checkAcknowledged },
      {
        id: 'video',
        label: lt.missionVideo,
        done: false,
      },
      { id: 'coach', label: lt.missionCoach, done: false },
      {
        id: 'cards',
        label: `${lt.missionFlashcards} (${sections?.dailyPlan?.flashcardCount ?? 14})`,
        done: dueCards.length === 0 && checkComplete,
      },
    ]
    return items
  }, [
    lt,
    teachDone,
    practiceDone,
    checkComplete,
    checkAcknowledged,
    sections?.dailyPlan?.flashcardCount,
    dueCards.length,
  ])

  const checklistDone = checklist.filter((c) => c.done).length

  const phaseButtons: { id: Phase; label: string; locked: boolean }[] = [
    { id: 'teach', label: lt.phaseTeach, locked: false },
    { id: 'practice', label: lt.phasePractice, locked: !teachDone && !checkComplete && hasTeaching },
    { id: 'check', label: lt.phaseCheck, locked: !practiceDone && !checkComplete && hasTeaching },
    { id: 'feedback', label: lt.phaseFeedback, locked: !checkComplete && hasTeaching },
    {
      id: 'missions',
      label: lt.phaseMissions,
      locked: !checkAcknowledged && hasTeaching,
    },
  ]

  return (
    <ShellLayout>
      <div className="mb-6 flex items-center gap-4">
        <ModuleGlyph moduleId="language-tutor" primary={mod.accent.primary} glow={mod.accent.glow} size={72} />
        <div>
          <Link href="/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]">
            {t.common.backToDashboard}
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{lt.title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{lt.subtitle}</p>
          {schedule && (
            <p className="mt-1 text-xs text-[var(--accent)]">
              {schedule.isRestDay ?
                lt.restDay
              : `${schedule.languageLabel} · ${lt.day} ${schedule.languageDay ?? progress?.languageDay ?? 1}/${progress?.unitsTotal || 16} · ${lt.programProgress}: ${progress?.completedCount ?? 0}/${schedule.goalDays} · ${lt.streak}: ${schedule.streak}`}
            </p>
          )}
        </div>
      </div>

      {warning && (
        <p className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {warning}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowSettings((s) => !s)}
        className="mb-4 text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        {showSettings ? '▾' : '▸'} {lt.settings}
      </button>
      {showSettings && (
        <GlassPanel className="mb-4 flex flex-wrap items-end gap-3 p-4">
          <label className="text-xs text-[var(--text-muted)]">
            {lt.programStart}
            <input
              type="date"
              value={programStart}
              onChange={(e) => setProgramStart(e.target.value)}
              className="mt-1 block rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-[var(--text-muted)]">
            {lt.goalDays}
            <input
              type="number"
              min={30}
              max={365}
              value={goalDays}
              onChange={(e) => setGoalDays(Number(e.target.value))}
              className="mt-1 block w-24 rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-[var(--text-muted)]">
            {lt.nativeLanguage}
            <select
              value={nativeLanguage}
              onChange={(e) => setNativeLanguage(e.target.value)}
              className="mt-1 block rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={sundayBreak}
              onChange={(e) => setSundayBreak(e.target.checked)}
            />
            {lt.sundayBreak}
          </label>
          <label className="text-xs text-[var(--text-muted)]">
            {lt.rotation}
            <input
              value={rotation}
              onChange={(e) => setRotation(e.target.value)}
              placeholder="fr,es,ar"
              className="mt-1 block rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <Button variant="outline" onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? lt.generating : lt.saveSettings}
          </Button>
          <p className="basis-full text-xs text-[var(--text-muted)]">{lt.frTrackNote}</p>
        </GlassPanel>
      )}

      {progress && !schedule?.isRestDay && (
        <GlassPanel className="mb-4 space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--text)]">{lt.progressTitle}</h2>
            <p className="text-xs text-[var(--text-muted)]">{lt.progressHint}</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-border)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{
                width: `${Math.min(100, Math.round((progress.completedCount / Math.max(1, progress.goalDays)) * 100))}%`,
              }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--surface-border)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{lt.programProgress}</p>
              <p className="text-sm font-medium text-[var(--text)]">
                {progress.completedCount}/{progress.goalDays}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--surface-border)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{lt.unitProgress}</p>
              <p className="text-sm font-medium text-[var(--text)]">
                {progress.unitsPassed}/{progress.unitsTotal}
                {schedule?.currentUnit ? ` · ${schedule.currentUnit.topic}` : ''}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--surface-border)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{lt.lastQuiz}</p>
              <p className="text-sm font-medium text-[var(--text)]">
                {progress.lastQuizScore != null ? `${progress.lastQuizScore}%` : '—'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
            <span>FR {progress.completedByLanguage.fr ?? 0}</span>
            <span>ES {progress.completedByLanguage.es ?? 0}</span>
            <span>AR {progress.completedByLanguage.ar ?? 0}</span>
          </div>
          {progress.recentDone.length > 0 && (
            <ul className="space-y-1 border-t border-[var(--surface-border)] pt-2 text-xs text-[var(--text-muted)]">
              {progress.recentDone.slice(0, 5).map((row) => (
                <li key={`${row.date}-${row.language}`} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {row.date} · {row.language.toUpperCase()} · {row.topic}
                  </span>
                  <span>{row.quiz != null ? `${row.quiz}%` : '✓'}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(['today', 'chat', 'flashcards', 'immersion', 'report'] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium',
              tab === id ?
                'bg-[var(--accent)] text-white'
              : 'border border-[var(--surface-border)] text-[var(--text-muted)]',
            )}
          >
            {lt.tabs[id]}
          </button>
        ))}
      </div>

      {loading ?
        <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
      : <div className="grid gap-6 lg:grid-cols-[1fr]">
          {tab === 'today' && (
            <GlassPanel className="space-y-4 p-6">
              {schedule?.isRestDay ?
                <p className="text-sm text-[var(--text-muted)]">{lt.restDayHint}</p>
              : lesson ?
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold">
                      {schedule?.languageLabel} — {lesson.topic}
                    </h2>
                    <span className="text-xs text-[var(--text-muted)]">
                      {fillTemplate(lt.estimatedMinutes, { min: estimated })}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => generateLesson(true)} disabled={generating}>
                      {generating ? lt.generating : lt.regenerateLesson}
                    </Button>
                    <Button variant="outline" onClick={deleteTodayLesson} disabled={generating}>
                      {lt.deleteLesson}
                    </Button>
                  </div>

                  {!hasTeaching && (
                    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      {lt.legacyLessonHint}
                    </p>
                  )}

                  <div className="rounded-xl border border-[var(--surface-border)] px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--accent)]">{lt.dailyPlan}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {fillTemplate(lt.dailyPlanProgress, {
                          done: checklistDone,
                          total: checklist.length,
                        })}
                      </p>
                    </div>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {checklist.map((item) => (
                        <li
                          key={item.id}
                          className={cn(
                            'text-xs',
                            item.done ? 'text-emerald-400' : 'text-[var(--text-muted)]',
                          )}
                        >
                          {item.done ? '✓' : '○'} {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {schedule?.currentUnit && (
                    <div className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-xs">
                      <p className="font-semibold text-[var(--accent)]">{lt.grammarGate}</p>
                      <p className="text-[var(--text-muted)]">{schedule.currentUnit.grammarFocus}</p>
                      <p className="mt-1">
                        {schedule.grammarMastery?.passed || schedule.grammarGateOpen ?
                          <span className="text-emerald-400">{lt.grammarPassed}</span>
                        : <span>
                            {lt.grammarPending}
                            {schedule.grammarMastery ?
                              ` (${schedule.grammarMastery.mastery_score}%)`
                            : ''}
                          </span>
                        }
                      </p>
                      <p className="mt-1 text-[var(--text-muted)]">
                        {fillTemplate(lt.quizPassHint, { score: passThreshold })}
                      </p>
                    </div>
                  )}
                  {schedule?.currentUnit?.repeatUnit && (
                    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      {lt.repeatUnit}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {phaseButtons.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={p.locked}
                        onClick={() => setPhase(p.id)}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-medium',
                          phase === p.id ?
                            'bg-[var(--accent)] text-white'
                          : p.locked ?
                            'cursor-not-allowed opacity-40 border border-[var(--surface-border)] text-[var(--text-muted)]'
                          : 'border border-[var(--surface-border)] text-[var(--text-muted)]',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {phase === 'teach' && (
                    <div className="space-y-4" dir={textDir}>
                      {sections?.teaching ?
                        <>
                          {sections.teaching.goals && sections.teaching.goals.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.teachingGoals}</h3>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
                                {sections.teaching.goals.map((g) => (
                                  <li key={g}>{g}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {sections.teaching.explanationMd && (
                            <LessonMarkdown content={sections.teaching.explanationMd} />
                          )}
                          {sections.teaching.keyPatterns && sections.teaching.keyPatterns.length > 0 && (
                            <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/30 p-4">
                              <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.keyPatterns}</h3>
                              <ul className="mt-3 space-y-2 text-sm">
                                {sections.teaching.keyPatterns.map((p) => (
                                  <li
                                    key={p}
                                    className="rounded-lg border border-[var(--surface-border)]/60 bg-[var(--background)]/40 px-3 py-2 text-[var(--text)]"
                                  >
                                    {p}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {sections.teaching.commonMistakes && sections.teaching.commonMistakes.length > 0 && (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                              <h3 className="text-sm font-semibold text-amber-200">{lt.commonMistakes}</h3>
                              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--text-muted)]">
                                {sections.teaching.commonMistakes.map((m) => (
                                  <li key={m}>{m}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      : null}

                      {sections?.words && sections.words.length > 0 && (
                        <div className="rounded-xl border border-[var(--surface-border)] p-4">
                          <h3 className="text-sm font-semibold text-[var(--accent)]">
                            {lt.words} ({sections.words.length})
                          </h3>
                          <ul className="mt-3 divide-y divide-[var(--surface-border)]/70">
                            {sections.words.map((w) => (
                              <li key={w.word} className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-baseline sm:gap-3">
                                <strong className="min-w-[7rem] text-[var(--text)]">{w.word}</strong>
                                <span className="text-[var(--text-muted)]">{w.translation}</span>
                                {w.example && (
                                  <span className="text-xs italic text-[var(--text-muted)] sm:ml-auto">
                                    {w.example}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sections?.grammarRules?.map((g) => (
                        <div
                          key={g.rule}
                          className="rounded-xl border border-[var(--surface-border)] p-4"
                        >
                          <h3 className="text-sm font-semibold text-[var(--accent)]">{g.rule}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                            {g.explanation}
                          </p>
                          {g.examples?.length > 0 && (
                            <ul className="mt-3 space-y-1.5 border-t border-[var(--surface-border)]/70 pt-3 text-sm text-[var(--text)]">
                              {g.examples.map((e) => (
                                <li key={e} className="rounded-lg bg-[var(--background-alt)]/40 px-3 py-1.5">
                                  {e}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}

                      {!hasTeaching && !sections?.words?.length && (
                        <p className="text-sm text-[var(--text-muted)]">{lt.legacyLessonHint}</p>
                      )}

                      <Button
                        onClick={() => {
                          setTeachDone(true)
                          setPhase('practice')
                        }}
                      >
                        {lt.finishTeach}
                      </Button>
                    </div>
                  )}

                  {phase === 'practice' && (
                    <div className="space-y-4" dir={textDir}>
                      {sections?.drills && sections.drills.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.drills}</h3>
                          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                            {sections.drills.map((d, i) => (
                              <li key={`drill-${i}`}>
                                <span className="text-[10px] uppercase text-[var(--text-muted)]">
                                  {d.type}
                                </span>
                                <p>{d.prompt}</p>
                                {d.hint && !revealedDrills.has(i) && (
                                  <p className="text-xs text-[var(--text-muted)]">{d.hint}</p>
                                )}
                                {revealedDrills.has(i) ?
                                  <p className="text-xs text-emerald-400">→ {d.answer}</p>
                                : <button
                                    type="button"
                                    onClick={() => setRevealedDrills((s) => new Set(s).add(i))}
                                    className="text-xs text-[var(--accent)] hover:underline"
                                  >
                                    {lt.revealDrillAnswer}
                                  </button>
                                }
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {sections?.dialogues && sections.dialogues.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.dialogues}</h3>
                          {sections.dialogues.map((d) => (
                            <div key={d.context} className="mt-2 text-sm">
                              <p className="font-medium">{d.context}</p>
                              <ul className="mt-1 space-y-0.5 text-[var(--text-muted)]">
                                {d.lines.map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {sections?.reading?.text && (
                        <div>
                          <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.reading}</h3>
                          <p className="text-sm font-medium">{sections.reading.title}</p>
                          <p className="mt-1 text-sm">{sections.reading.text}</p>
                          {sections.reading.questions?.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold text-[var(--accent)]">
                                {lt.readingQuestions}
                              </p>
                              <ol className="mt-1 list-decimal pl-5 text-sm text-[var(--text-muted)]">
                                {sections.reading.questions.map((q) => (
                                  <li key={q}>{q}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      )}

                      <Button
                        onClick={() => {
                          setPracticeDone(true)
                          setPhase('check')
                        }}
                      >
                        {lt.finishPractice}
                      </Button>
                    </div>
                  )}

                  {phase === 'check' && (
                    <div className="space-y-4">
                      {sections?.speakingExercise && (
                        <div className="space-y-2">
                          <p className="text-sm" dir={textDir}>
                            <strong>{lt.speaking}:</strong> {sections.speakingExercise.prompt}
                          </p>
                          <textarea
                            value={speakingAnswer}
                            onChange={(e) => setSpeakingAnswer(e.target.value)}
                            placeholder={lt.speakingPlaceholder}
                            rows={2}
                            dir={textDir}
                            className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
                          />
                        </div>
                      )}
                      {sections?.writingExercise && (
                        <div className="space-y-2">
                          <p className="text-sm" dir={textDir}>
                            <strong>{lt.writing}:</strong> {sections.writingExercise.prompt}
                          </p>
                          <textarea
                            value={writingAnswer}
                            onChange={(e) => setWritingAnswer(e.target.value)}
                            placeholder={lt.writingPlaceholder}
                            rows={3}
                            dir={textDir}
                            className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
                          />
                        </div>
                      )}
                      {sections?.quiz && sections.quiz.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-[var(--accent)]">
                            {lt.quiz} ({sections.quiz.length})
                          </h3>
                          <div className="space-y-3">
                            {sections.quiz.map((q, i) => {
                              const options =
                                Array.isArray(q.options) && q.options.length > 0 ?
                                  q.options
                                : null
                              return (
                                <div
                                  key={`q-${i}`}
                                  className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/40 p-3"
                                >
                                  <p className="text-sm font-medium text-[var(--text)]" dir={textDir}>
                                    <span className="mr-2 text-[var(--text-muted)]">{i + 1}.</span>
                                    {q.question}
                                  </p>
                                  {options ?
                                    <div className="mt-3 space-y-2" role="radiogroup" aria-label={`Q${i + 1}`}>
                                      {options.map((opt, oi) => {
                                        const selected = quizAnswers[i] === opt
                                        return (
                                          <label
                                            key={`q-${i}-opt-${oi}`}
                                            className={cn(
                                              'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition',
                                              selected
                                                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                                                : 'border-[var(--surface-border)] hover:border-[var(--accent)]/50',
                                            )}
                                          >
                                            <input
                                              type="radio"
                                              name={`quiz-${i}`}
                                              className="mt-1"
                                              checked={selected}
                                              onChange={() =>
                                                setQuizAnswers((prev) => ({ ...prev, [i]: opt }))
                                              }
                                            />
                                            <span dir={textDir}>{opt}</span>
                                          </label>
                                        )
                                      })}
                                    </div>
                                  : (
                                    <div className="mt-3 space-y-2">
                                      <input
                                        type="text"
                                        value={quizAnswers[i] ?? ''}
                                        onChange={(e) =>
                                          setQuizAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                                        }
                                        dir={textDir}
                                        className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm"
                                        placeholder="…"
                                      />
                                      {!revealedQuiz.has(i) ?
                                        <button
                                          type="button"
                                          onClick={() => setRevealedQuiz((s) => new Set(s).add(i))}
                                          className="text-xs text-[var(--accent)] hover:underline"
                                        >
                                          {lt.showAnswer}
                                        </button>
                                      : (
                                        <p className="text-xs text-[var(--text-muted)]">→ {q.answer}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={submitPractice} disabled={submitting}>
                          {submitting ? lt.grading : lt.submitPractice}
                        </Button>
                        {checkComplete && (
                          <Button variant="outline" onClick={() => setPhase('feedback')}>
                            {lt.phaseFeedback}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {phase === 'feedback' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--accent)]">
                          {lt.feedbackTitle}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {fillTemplate(lt.quizScoreLabel, {
                            score: quizScoreNow ?? sections?.submissions?.quizScore ?? 0,
                          })}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {lt.passAfterReviewHint}
                        </p>
                      </div>

                      {sections?.quiz && sections.quiz.length > 0 && (
                        <div className="space-y-3">
                          {sections.quiz.map((q, i) => {
                            const given = quizAnswers[i] ?? sections.submissions?.quizAnswers?.[String(i)] ?? ''
                            const expected = q.answer ?? ''
                            const ok =
                              given &&
                              normalizeQuizAnswer(given) === normalizeQuizAnswer(expected)
                            return (
                              <div
                                key={`fb-${i}`}
                                className={cn(
                                  'rounded-xl border p-3',
                                  ok
                                    ? 'border-emerald-500/40 bg-emerald-500/5'
                                    : 'border-amber-500/40 bg-amber-500/5',
                                )}
                              >
                                <p className="text-sm font-medium text-[var(--text)]" dir={textDir}>
                                  <span className="mr-2 text-[var(--text-muted)]">{i + 1}.</span>
                                  {q.question}
                                </p>
                                <p className="mt-2 text-xs text-[var(--text-muted)]">
                                  {lt.yourAnswer}:{' '}
                                  <span dir={textDir}>{given || lt.unanswered}</span>
                                </p>
                                <p className="mt-1 text-xs text-[var(--text)]">
                                  {lt.correctAnswer}: <span dir={textDir}>{expected}</span>
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {(feedback || sections?.submissions?.feedback) && (
                        <p className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm text-[var(--text-muted)]">
                          {feedback || sections?.submissions?.feedback}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={retakeCheck}>
                          {lt.retakeCheck}
                        </Button>
                        {!checkAcknowledged ?
                          <Button onClick={acknowledgeCheck} disabled={submitting}>
                            {submitting ? lt.grading : lt.acknowledgeUnderstood}
                          </Button>
                        : (
                          <Button onClick={() => setPhase('missions')}>
                            {lt.phaseMissions}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {phase === 'missions' && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-3 space-y-2">
                        <Button
                          className="w-full sm:w-auto"
                          onClick={completeLesson}
                          disabled={!canComplete || submitting}
                        >
                          {submitting ? lt.grading : lt.markDone}
                        </Button>
                        <p className="text-xs text-[var(--text-muted)]">{lt.passAfterReviewHint}</p>
                        <div className="flex flex-wrap gap-2">
                          {checkComplete && (
                            <Button variant="outline" onClick={() => setPhase('feedback')}>
                              {lt.phaseFeedback}
                            </Button>
                          )}
                          <Button variant="outline" onClick={retakeCheck}>
                            {lt.retakeCheck}
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-[var(--surface-border)] p-3">
                        <p className="text-xs font-semibold text-[var(--accent)]">{lt.missionVideo}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {sections?.dailyPlan?.videoTask ?? lt.youtube}
                        </p>
                        {(lesson.youtube_url || sections?.youtubeUrl) && (
                          <a
                            href={lesson.youtube_url ?? sections?.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-sm text-[var(--accent)] hover:underline"
                          >
                            {lt.openMission}
                          </a>
                        )}
                      </div>
                      <div className="rounded-xl border border-[var(--surface-border)] p-3">
                        <p className="text-xs font-semibold text-[var(--accent)]">{lt.missionCoach}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {sections?.dailyPlan?.coachPrompt ?? lt.modes.grammar}
                        </p>
                        <button
                          type="button"
                          onClick={openCoachMission}
                          className="mt-2 text-sm text-[var(--accent)] hover:underline"
                        >
                          {lt.openMission}
                        </button>
                      </div>
                      <div className="rounded-xl border border-[var(--surface-border)] p-3">
                        <p className="text-xs font-semibold text-[var(--accent)]">
                          {lt.missionFlashcards} ({sections?.dailyPlan?.flashcardCount ?? dueCards.length})
                        </p>
                        <button
                          type="button"
                          onClick={() => setTab('flashcards')}
                          className="mt-2 text-sm text-[var(--accent)] hover:underline"
                        >
                          {lt.openMission}
                        </button>
                      </div>
                      <div className="rounded-xl border border-[var(--surface-border)] p-3">
                        <p className="text-xs font-semibold text-[var(--accent)]">{lt.missionImmersion}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {sections?.dailyPlan?.immersionTask ?? sections?.immersion?.why}
                        </p>
                        <button
                          type="button"
                          onClick={() => setTab('immersion')}
                          className="mt-2 text-sm text-[var(--accent)] hover:underline"
                        >
                          {lt.openMission}
                        </button>
                      </div>

                    </div>
                  )}
                </>
              : <div className="space-y-3">
                  <p className="text-sm text-[var(--text-muted)]">{lt.noLesson}</p>
                  <Button onClick={() => generateLesson(false)} disabled={generating}>
                    {generating ? lt.generating : lt.generateLesson}
                  </Button>
                </div>
              }
            </GlassPanel>
          )}

          {tab === 'chat' && (
            <GlassPanel className="flex flex-col p-6">
              <div className="mb-3 flex flex-wrap gap-2">
                {(['friend', 'pronunciation', 'voice_coach', 'grammar'] as ChatMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setChatMode(m)
                      setChatMessages([])
                    }}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px]',
                      chatMode === m ? 'bg-[var(--accent)] text-white' : 'border border-[var(--surface-border)]',
                    )}
                  >
                    {lt.modes[m]}
                  </button>
                ))}
                <select
                  value={chatLang}
                  onChange={(e) => setChatLang(e.target.value)}
                  className="rounded-lg border border-[var(--surface-border)] bg-transparent px-2 py-1 text-xs"
                >
                  <option value="fr">FR</option>
                  <option value="es">ES</option>
                  <option value="ar">AR</option>
                </select>
              </div>
              <div className="max-h-80 flex-1 space-y-2 overflow-y-auto">
                {chatMessages.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm',
                      m.role === 'user' ?
                        'ml-8 bg-[var(--accent-soft)]'
                      : 'mr-8 bg-[var(--background-alt)]',
                    )}
                  >
                    {m.content}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void sendChat(chatInput)}
                  placeholder={lt.chatPlaceholder}
                  className="flex-1 rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
                />
                {isSpeechRecognitionSupported() && (
                  <Button
                    variant={listening ? 'primary' : 'outline'}
                    onClick={toggleMic}
                    aria-pressed={listening}
                  >
                    {listening ? lt.micStop : lt.micStart}
                  </Button>
                )}
                <Button onClick={() => sendChat(chatInput)} disabled={chatSending}>
                  {lt.send}
                </Button>
              </div>
            </GlassPanel>
          )}

          {tab === 'flashcards' && (
            <GlassPanel className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[var(--text-muted)]">{lt.flashcardProgressHint}</p>
                <Button
                  variant="outline"
                  onClick={generateNewFlashcards}
                  disabled={generatingCards}
                >
                  {generatingCards ? lt.generating : lt.generateFlashcards}
                </Button>
              </div>
              {currentCard ?
                <div className="text-center">
                  <p className="text-xs text-[var(--text-muted)]">
                    {cardIndex + 1}/{dueCards.length} · {currentCard.language.toUpperCase()}
                  </p>
                  <p className="mt-4 text-2xl font-semibold">{currentCard.word}</p>
                  {showAnswer && (
                    <div className="mt-4 text-sm text-[var(--text-muted)]">
                      <p>{currentCard.translation}</p>
                      {currentCard.ipa && <p className="text-xs">[{currentCard.ipa}]</p>}
                      {currentCard.example_sentence && (
                        <p className="mt-2">{currentCard.example_sentence}</p>
                      )}
                    </div>
                  )}
                  <div className="mt-6 flex justify-center gap-2">
                    {!showAnswer ?
                      <Button onClick={() => setShowAnswer(true)}>{lt.showAnswer}</Button>
                    : <>
                        <Button variant="outline" onClick={() => reviewCard(1)}>
                          {lt.srsAgain}
                        </Button>
                        <Button variant="outline" onClick={() => reviewCard(2)}>
                          {lt.srsHard}
                        </Button>
                        <Button variant="outline" onClick={() => reviewCard(4)}>
                          {lt.srsGood}
                        </Button>
                        <Button onClick={() => reviewCard(5)}>{lt.srsEasy}</Button>
                      </>
                    }
                  </div>
                </div>
              : <p className="text-sm text-[var(--text-muted)]">{lt.noCards}</p>}
            </GlassPanel>
          )}

          {tab === 'immersion' && (
            <GlassPanel className="space-y-4 p-6">
              {schedule?.isRestDay ?
                <p className="text-sm text-[var(--text-muted)]">{lt.restDayHint}</p>
              : immersion ?
                <>
                  <p className="text-xs text-[var(--accent)]">
                    {immersion.cefr} · {immersion.why}
                  </p>
                  {sections?.dailyPlan?.immersionTask && (
                    <p className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm">
                      {sections.dailyPlan.immersionTask}
                    </p>
                  )}
                  {immersion.youtubeUrl && (
                    <a
                      href={immersion.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--accent)] hover:underline"
                    >
                      {lt.youtube}
                    </a>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.filmsTitle}</h3>
                    <ul className="mt-2 space-y-2 text-sm text-[var(--text-muted)]">
                      {immersion.films.map((f) => (
                        <li key={f} className="flex flex-wrap items-center justify-between gap-2">
                          <span>{f}</span>
                          <button
                            type="button"
                            onClick={() => void markImmersionDone('film', f)}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            {lt.markImmersionDone}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.booksTitle}</h3>
                    <ul className="mt-2 space-y-2 text-sm text-[var(--text-muted)]">
                      {immersion.books.map((b) => (
                        <li key={b} className="flex flex-wrap items-center justify-between gap-2">
                          <span>{b}</span>
                          <button
                            type="button"
                            onClick={() => void markImmersionDone('book', b)}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            {lt.markImmersionDone}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {((immersion.doneFilms?.length ?? 0) > 0 || (immersion.doneBooks?.length ?? 0) > 0) && (
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.immersionDoneTitle}</h3>
                      <ul className="mt-2 list-disc pl-5 text-xs text-[var(--text-muted)]">
                        {(immersion.doneFilms ?? []).map((f) => (
                          <li key={`df-${f}`}>🎬 {f}</li>
                        ))}
                        {(immersion.doneBooks ?? []).map((b) => (
                          <li key={`db-${b}`}>📖 {b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {immersion.cultureBooks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.cultureBooks}</h3>
                      <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                        {immersion.cultureBooks.map((b) => (
                          <li key={b.title}>
                            {b.title}
                            {b.author ? ` — ${b.author}` : ''} [{b.status}]
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              : <p className="text-sm text-[var(--text-muted)]">{lt.noLesson}</p>}
            </GlassPanel>
          )}

          {tab === 'report' && (
            <GlassPanel className="space-y-4 p-6">
              <Button variant="outline" onClick={genReport}>
                {lt.genReport}
              </Button>
              {topErrors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.topErrors}</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {topErrors.map((e) => (
                      <li key={e.mistake}>
                        {e.mistake} → {e.correction} (×{e.count})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report?.content_md && <LessonMarkdown content={report.content_md} />}
            </GlassPanel>
          )}
        </div>
      }
    </ShellLayout>
  )
}
