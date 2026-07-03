import { createClaudeMessage } from './claude'

export type TutorLanguage = 'fr' | 'es' | 'ar'
export type ChatMode = 'friend' | 'pronunciation' | 'voice_coach' | 'grammar'

const LANG_NAMES: Record<TutorLanguage, string> = {
  fr: 'French',
  es: 'Spanish',
  ar: 'Modern Standard Arabic',
}

const EXPLAIN_LANG: Record<string, string> = {
  tr: 'Turkish',
  en: 'English',
}

export interface DailyLessonInput {
  language: TutorLanguage
  locale: string
  programDay: number
  topic: string
  grammarFocus: string
  youtubeUrl: string
  recentScores?: { vocab?: number; grammar?: number; speaking?: number }
}

export interface DailyLessonSections {
  words: Array<{ word: string; translation: string; ipa?: string; example: string }>
  grammarRules: Array<{ rule: string; explanation: string; examples: string[] }>
  dialogues: Array<{ context: string; lines: string[] }>
  reading: { title: string; text: string; questions: string[] }
  speakingExercise: { prompt: string; hints: string[] }
  writingExercise: { prompt: string; minSentences: number }
  quiz: Array<{ question: string; options?: string[]; answer: string }>
  youtubeUrl: string
  immersion: { films: string[]; books: string[]; why: string }
}

export async function generateDailyLesson(input: DailyLessonInput): Promise<{
  sections: DailyLessonSections
  contentMd: string
}> {
  const explainIn = EXPLAIN_LANG[input.locale] ?? 'English'
  const target = LANG_NAMES[input.language]
  const difficulty =
    (input.recentScores?.vocab ?? 70) >= 80 ? 'slightly harder than yesterday'
    : 'beginner-friendly'

  let sections = defaultLesson(input)

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const raw = await createClaudeMessage({
        system: `Expert ${target} teacher. Create a 20-minute beginner daily lesson. Explain grammar in ${explainIn}. Target language content in ${target}. Return JSON only matching DailyLessonSections shape. Difficulty: ${difficulty}. Include exactly: 10 words, 3 grammar rules, 5 dialogue snippets (short), 1 reading (~80 words), speaking + writing exercise, 5 quiz questions.`,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              programDay: input.programDay,
              topic: input.topic,
              grammarFocus: input.grammarFocus,
              youtubeUrl: input.youtubeUrl,
            }),
          },
        ],
        maxTokens: 4000,
        temperature: 0.45,
      })
      const parsed = JSON.parse(extractJson(raw)) as DailyLessonSections
      if (parsed.words?.length) sections = { ...sections, ...parsed, youtubeUrl: input.youtubeUrl }
    } catch {
      // defaults
    }
  }

  const contentMd = lessonToMarkdown(sections, input, explainIn)
  return { sections, contentMd }
}

function defaultLesson(input: DailyLessonInput): DailyLessonSections {
  return {
    words: [],
    grammarRules: [{ rule: input.grammarFocus, explanation: 'See lesson topic.', examples: [] }],
    dialogues: [],
    reading: { title: input.topic, text: '', questions: [] },
    speakingExercise: { prompt: `Introduce yourself in ${LANG_NAMES[input.language]}.`, hints: [] },
    writingExercise: { prompt: 'Write 3 sentences about your day.', minSentences: 3 },
    quiz: [],
    youtubeUrl: input.youtubeUrl,
    immersion: { films: [], books: [], why: 'Build immersion habit.' },
  }
}

function lessonToMarkdown(
  s: DailyLessonSections,
  input: DailyLessonInput,
  explainIn: string,
): string {
  const lines = [
    `# ${LANG_NAMES[input.language]} · Day ${input.programDay}`,
    `**${input.topic}**`,
    '',
    '## 10 words',
    ...s.words.map((w) => `- **${w.word}** — ${w.translation}${w.ipa ? ` [${w.ipa}]` : ''}\n  ${w.example}`),
    '',
    '## Grammar',
    ...s.grammarRules.flatMap((g) => [
      `### ${g.rule}`,
      g.explanation,
      ...g.examples.map((e) => `- ${e}`),
      '',
    ]),
    '## Dialogues',
    ...s.dialogues.flatMap((d) => [`**${d.context}**`, ...d.lines.map((l) => `- ${l}`), '']),
    '## Reading',
    `### ${s.reading.title}`,
    s.reading.text,
    '',
    '## Speaking',
    s.speakingExercise.prompt,
    '',
    '## Writing',
    s.writingExercise.prompt,
    '',
    '## Quiz',
    ...s.quiz.map((q, i) => `${i + 1}. ${q.question}`),
    '',
    `## YouTube\n${s.youtubeUrl}`,
  ]
  return lines.join('\n')
}

export async function languageTutorChat(opts: {
  mode: ChatMode
  language: TutorLanguage
  locale: string
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  grammarTopic?: string
}): Promise<string> {
  const target = LANG_NAMES[opts.language]
  const explainIn = EXPLAIN_LANG[opts.locale] ?? 'English'

  const systems: Record<ChatMode, string> = {
    friend: `You are the user's ${target} friend. Reply ONLY in ${target}. Casual chat. When they make mistakes, respond in ${target} first, then add a short block in ${explainIn}:
WRONG: ...
RIGHT: ...
WHY: ...
NATURAL: ...
Keep conversation flowing with a follow-up question.`,

    pronunciation: `Pronunciation coach for ${target}. User sends sentences. For each sentence provide in ${explainIn}:
- IPA transcription
- ${explainIn} pronunciation guide
- Critical sounds
- Liaison/linking notes (if French)
- Natural accent tips`,

    voice_coach: `Voice conversation coach for ${target}. Short natural replies ONLY in ${target}. End every message with a question. Get the user speaking. On errors: say correct phrase in ${target}, one-line ${explainIn} why, continue chat. No long lectures.`,

    grammar: `World-class ${target} grammar teacher. Explain in ${explainIn} like teaching a 10-year-old. Topic: ${opts.grammarTopic ?? 'current lesson'}. Use real examples, common mistakes, mini quiz. Do not advance until user shows understanding. When user answers correctly twice in a row, end with a line: MASTERY_SCORE: <0-100> and if score >= 80 add PASSED: yes`,
  }

  return createClaudeMessage({
    system: systems[opts.mode],
    messages: [
      ...opts.history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: opts.message },
    ],
    maxTokens: opts.mode === 'grammar' ? 1500 : 800,
    temperature: opts.mode === 'friend' ? 0.65 : 0.4,
  })
}

export async function generateFlashcardsFromWords(
  language: TutorLanguage,
  words: Array<{ word: string; translation: string }>,
  locale: string,
): Promise<
  Array<{
    word: string
    translation: string
    ipa: string
    example_sentence: string
    synonyms: string
    antonyms: string
    reviewDays: number[]
  }>
> {
  const target = LANG_NAMES[language]
  const explainIn = EXPLAIN_LANG[locale] ?? 'English'

  if (!process.env.ANTHROPIC_API_KEY) {
    return words.map((w) => ({
      ...w,
      ipa: '',
      example_sentence: '',
      synonyms: '',
      antonyms: '',
      reviewDays: [1, 3, 7, 14],
    }))
  }

  try {
    const raw = await createClaudeMessage({
      system: `Create flashcards for ${target}. Return JSON array: [{word, translation, ipa, example_sentence, synonyms, antonyms, reviewDays:[1,3,7,14]}]. Example sentences in ${target}, meanings in ${explainIn}.`,
      messages: [{ role: 'user', content: JSON.stringify(words) }],
      maxTokens: 2000,
      temperature: 0.3,
    })
    return JSON.parse(extractJson(raw)) as Array<{
      word: string
      translation: string
      ipa: string
      example_sentence: string
      synonyms: string
      antonyms: string
      reviewDays: number[]
    }>
  } catch {
    return words.map((w) => ({
      ...w,
      ipa: '',
      example_sentence: '',
      synonyms: '',
      antonyms: '',
      reviewDays: [1, 3, 7, 14],
    }))
  }
}

export async function generateWeeklyReport(opts: {
  locale: string
  errors: Array<{ language: string; mistake: string; correction: string; count: number }>
  lessonsCompleted: number
  streak: number
  byLanguage: Record<string, { lessons: number; avgScore: number }>
}): Promise<{ contentMd: string; sections: Record<string, unknown> }> {
  const explainIn = EXPLAIN_LANG[opts.locale] ?? 'English'

  let contentMd = `## Weekly report\nLessons: ${opts.lessonsCompleted} · Streak: ${opts.streak}\n`
  const topErrors = opts.errors.slice(0, 10)

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      contentMd = await createClaudeMessage({
        system: `Language learning coach weekly report in ${explainIn}. Include: progress summary, top 10 repeated mistakes, correction plan, encouragement. Be disciplined like a strict teacher.`,
        messages: [{ role: 'user', content: JSON.stringify({ ...opts, topErrors }) }],
        maxTokens: 1200,
        temperature: 0.4,
      })
    } catch {
      contentMd += topErrors.map((e) => `- ${e.mistake} → ${e.correction} (×${e.count})`).join('\n')
    }
  }

  return {
    contentMd,
    sections: { lessonsCompleted: opts.lessonsCompleted, streak: opts.streak, topErrors },
  }
}

export function parseErrorsFromFriendReply(
  reply: string,
): Array<{ mistake: string; correction: string; explanation?: string; natural?: string }> {
  const errors: Array<{ mistake: string; correction: string; explanation?: string; natural?: string }> = []
  const wrong = reply.match(/WRONG:\s*(.+)/i)?.[1]?.trim()
  const right = reply.match(/RIGHT:\s*(.+)/i)?.[1]?.trim()
  const why = reply.match(/WHY:\s*(.+)/i)?.[1]?.trim()
  const natural = reply.match(/NATURAL:\s*(.+)/i)?.[1]?.trim()
  if (wrong && right) {
    errors.push({ mistake: wrong, correction: right, explanation: why, natural })
  }
  return errors
}

export function parseGrammarMastery(reply: string): { score: number; passed: boolean } | null {
  const scoreMatch = reply.match(/MASTERY_SCORE:\s*(\d+)/i)
  if (!scoreMatch) return null
  const score = Math.min(100, Math.max(0, parseInt(scoreMatch[1]!, 10)))
  const passed = /PASSED:\s*yes/i.test(reply) || score >= 80
  return { score, passed }
}

export async function gradeSpeakingWriting(opts: {
  language: TutorLanguage
  locale: string
  speaking?: string
  writing?: string
  speakingPrompt: string
  writingPrompt: string
}): Promise<{ speaking: number; writing: number; feedback: string }> {
  const target = LANG_NAMES[opts.language]
  const explainIn = EXPLAIN_LANG[opts.locale] ?? 'English'

  const fallback = {
    speaking: opts.speaking?.trim() ? 70 : 0,
    writing: opts.writing?.trim() ? 70 : 0,
    feedback: 'Submitted — keep practicing daily.',
  }

  if (!process.env.ANTHROPIC_API_KEY) return fallback

  try {
    const raw = await createClaudeMessage({
      system: `Strict ${target} teacher. Grade beginner speaking and writing 0-100. Reply in ${explainIn} with JSON only: {speaking:number, writing:number, feedback:string}. Be honest but encouraging.`,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            speakingPrompt: opts.speakingPrompt,
            speakingAnswer: opts.speaking ?? '',
            writingPrompt: opts.writingPrompt,
            writingAnswer: opts.writing ?? '',
          }),
        },
      ],
      maxTokens: 600,
      temperature: 0.3,
    })
    const parsed = JSON.parse(extractJson(raw)) as {
      speaking: number
      writing: number
      feedback: string
    }
    return {
      speaking: Math.min(100, Math.max(0, parsed.speaking ?? 0)),
      writing: Math.min(100, Math.max(0, parsed.writing ?? 0)),
      feedback: parsed.feedback ?? fallback.feedback,
    }
  } catch {
    return fallback
  }
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1]!.trim()
  const start = text.indexOf('{')
  const arrStart = text.indexOf('[')
  if (arrStart >= 0 && (start < 0 || arrStart < start)) {
    const end = text.lastIndexOf(']')
    if (end > arrStart) return text.slice(arrStart, end + 1)
  }
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text
}
