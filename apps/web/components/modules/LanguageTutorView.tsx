'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button, cn } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
} from '@/lib/voice/speech'

type Tab = 'today' | 'chat' | 'flashcards' | 'immersion' | 'report'
type ChatMode = 'friend' | 'pronunciation' | 'voice_coach' | 'grammar'

interface Lesson {
  id: string
  language: string
  topic: string
  status: string
  sections?: {
    words?: Array<{ word: string; translation: string; ipa?: string; example: string }>
    grammarRules?: Array<{ rule: string; explanation: string; examples: string[] }>
    dialogues?: Array<{ context: string; lines: string[] }>
    reading?: { title: string; text: string; questions: string[] }
    speakingExercise?: { prompt: string }
    writingExercise?: { prompt: string }
    quiz?: Array<{ question: string; answer: string }>
    youtubeUrl?: string
    immersion?: { films: string[]; books: string[]; why: string }
  }
  youtube_url?: string
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

export function LanguageTutorView() {
  const { t, locale } = useLocale()
  const lt = t.languageTutor
  const mod = getModuleById('language-tutor')!
  const bottomRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<Tab>('today')
  const [schedule, setSchedule] = useState<{
    language: string | null
    languageLabel: string | null
    isRestDay: boolean
    programDay: number
    goalDays: number
    streak: number
    currentUnit?: { id: string; topic: string; grammarFocus: string; repeatUnit?: boolean } | null
    grammarMastery?: { topic_id: string; mastery_score: number; passed: boolean } | null
    grammarGateOpen?: boolean
  } | null>(null)
  const [immersion, setImmersion] = useState<{
    films: string[]
    books: string[]
    cultureBooks: Array<{ title: string; author: string | null; status: string }>
    youtubeUrl: string | null
    why: string
    cefr: string
  } | null>(null)
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
  const [quizCorrect, setQuizCorrect] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [rotation, setRotation] = useState('fr,es,ar')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/modules/language-tutor')
    const data = await res.json()
    if (data.warning === 'language_tutor_table_missing') setWarning(lt.warnings.tableMissing)
    if (res.ok) {
      setSchedule(data.schedule)
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

  async function generateLesson() {
    setGenerating(true)
    setError(null)
    const res = await fetch('/api/modules/language-tutor/lesson/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    })
    const data = await res.json()
    setGenerating(false)
    if (!res.ok) {
      setError(data.error ?? data.message ?? lt.errors.lessonFailed)
      return
    }
    if (data.restDay) {
      setError(lt.restDay)
      return
    }
    setLesson(data.lesson)
    await load()
  }

  async function submitPractice() {
    setSubmitting(true)
    setError(null)
    const quizTotal = sections?.quiz?.length ?? 0
    const quizScore =
      quizTotal > 0 ? Math.round((quizCorrect.size / quizTotal) * 100) : 80
    const res = await fetch('/api/modules/language-tutor/lesson/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lesson_date: new Date().toISOString().slice(0, 10),
        speaking: speakingAnswer,
        writing: writingAnswer,
        quiz_score: quizScore,
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
    await load()
  }

  async function completeLesson() {
    const res = await fetch('/api/modules/language-tutor/lesson/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson_date: new Date().toISOString().slice(0, 10) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.message ?? data.error ?? lt.errors.grammarBlocked)
      return
    }
    await load()
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

  function startMic() {
    const rec = createSpeechRecognition(chatLang)
    if (!rec) return
    setListening(true)
    rec.onresult = (ev) => {
      const t = ev.results[0]?.[0]?.transcript
      if (t) void sendChat(t)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
  }

  const sections = lesson?.sections
  const currentCard = dueCards[cardIndex]
  const isArabic = lesson?.language === 'ar' || chatLang === 'ar'
  const textDir = isArabic ? 'rtl' : 'ltr'

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
              : `${schedule.languageLabel} · ${lt.day} ${schedule.programDay}/${schedule.goalDays} · ${lt.streak}: ${schedule.streak}`}
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
                  <h2 className="text-lg font-semibold">
                    {schedule?.languageLabel} — {lesson.topic}
                  </h2>
                  {schedule?.currentUnit && (
                    <div className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-xs">
                      <p className="font-semibold text-[var(--accent)]">{lt.grammarGate}</p>
                      <p className="text-[var(--text-muted)]">{schedule.currentUnit.grammarFocus}</p>
                      <p className="mt-1">
                        {schedule.grammarMastery?.passed ?
                          <span className="text-emerald-400">{lt.grammarPassed}</span>
                        : <span>
                            {lt.grammarPending}
                            {schedule.grammarMastery ?
                              ` (${schedule.grammarMastery.mastery_score}%)`
                            : ''}
                          </span>
                        }
                      </p>
                    </div>
                  )}
                  {schedule?.currentUnit?.repeatUnit && (
                    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      {lt.repeatUnit}
                    </p>
                  )}
                  {sections?.words && sections.words.length > 0 && (
                    <div dir={textDir}>
                      <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.words}</h3>
                      <ul className="mt-2 space-y-1 text-sm">
                        {sections.words.map((w) => (
                          <li key={w.word}>
                            <strong>{w.word}</strong> — {w.translation}
                            {w.example && <span className="text-[var(--text-muted)]"> · {w.example}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sections?.grammarRules?.map((g) => (
                    <div key={g.rule} dir={textDir}>
                      <h3 className="text-sm font-semibold text-[var(--accent)]">{g.rule}</h3>
                      <p className="text-sm text-[var(--text-muted)]">{g.explanation}</p>
                    </div>
                  ))}
                  {sections?.dialogues && sections.dialogues.length > 0 && (
                    <div dir={textDir}>
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
                    <div dir={textDir}>
                      <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.reading}</h3>
                      <p className="text-sm">{sections.reading.text}</p>
                      {sections.reading.questions?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-[var(--accent)]">{lt.readingQuestions}</p>
                          <ol className="mt-1 list-decimal pl-5 text-sm text-[var(--text-muted)]">
                            {sections.reading.questions.map((q) => (
                              <li key={q}>{q}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
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
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.quiz}</h3>
                      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                        {sections.quiz.map((q, i) => (
                          <li key={`q-${i}`}>
                            <label className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={quizCorrect.has(i)}
                                onChange={(e) => {
                                  setQuizCorrect((s) => {
                                    const n = new Set(s)
                                    if (e.target.checked) n.add(i)
                                    else n.delete(i)
                                    return n
                                  })
                                }}
                              />
                              <span>
                                {q.question}
                                {revealedQuiz.has(i) && (
                                  <span className="ml-1 text-xs text-[var(--text-muted)]">→ {q.answer}</span>
                                )}
                              </span>
                            </label>
                            {!revealedQuiz.has(i) && (
                              <button
                                type="button"
                                onClick={() => setRevealedQuiz((s) => new Set(s).add(i))}
                                className="ml-6 text-xs text-[var(--accent)] hover:underline"
                              >
                                {lt.showAnswer}
                              </button>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {(lesson.youtube_url || sections?.youtubeUrl) && (
                    <a
                      href={lesson.youtube_url ?? sections?.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--accent)] hover:underline"
                    >
                      {lt.youtube}
                    </a>
                  )}
                  {sections?.immersion && (
                    <div className="text-xs text-[var(--text-muted)]">
                      <strong>{lt.immersion}:</strong> {sections.immersion.films.join(', ')} ·{' '}
                      {sections.immersion.books.join(', ')}
                    </div>
                  )}
                  {feedback && (
                    <p className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm text-[var(--text-muted)]">
                      {feedback}
                    </p>
                  )}
                  {lesson.status !== 'done' && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={submitPractice} disabled={submitting}>
                        {submitting ? lt.grading : lt.submitPractice}
                      </Button>
                      <Button
                        onClick={completeLesson}
                        disabled={!schedule?.grammarGateOpen}
                        title={!schedule?.grammarGateOpen ? lt.grammarBlocked : undefined}
                      >
                        {lt.markDone}
                      </Button>
                    </div>
                  )}
                  {lesson.status !== 'done' && !schedule?.grammarGateOpen && (
                    <p className="text-xs text-amber-300">{lt.grammarBlocked}</p>
                  )}
                </>
              : <div className="space-y-3">
                  <p className="text-sm text-[var(--text-muted)]">{lt.noLesson}</p>
                  <Button onClick={generateLesson} disabled={generating}>
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
                  <Button variant="outline" onClick={startMic} disabled={listening}>
                    {listening ? '…' : lt.mic}
                  </Button>
                )}
                <Button onClick={() => sendChat(chatInput)} disabled={chatSending}>
                  {lt.send}
                </Button>
              </div>
            </GlassPanel>
          )}

          {tab === 'flashcards' && (
            <GlassPanel className="p-6">
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
                      {currentCard.example_sentence && <p className="mt-2">{currentCard.example_sentence}</p>}
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
                  <p className="text-xs text-[var(--accent)]">{immersion.cefr} · {immersion.why}</p>
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
                    <ul className="mt-2 list-disc pl-5 text-sm text-[var(--text-muted)]">
                      {immersion.films.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--accent)]">{lt.booksTitle}</h3>
                    <ul className="mt-2 list-disc pl-5 text-sm text-[var(--text-muted)]">
                      {immersion.books.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
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
              {report?.content_md && (
                <pre className="whitespace-pre-wrap text-sm text-[var(--text-muted)]">{report.content_md}</pre>
              )}
            </GlassPanel>
          )}
        </div>
      }
    </ShellLayout>
  )
}
