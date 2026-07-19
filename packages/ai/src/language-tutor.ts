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
  recentScores?: { vocab?: number; grammar?: number; speaking?: number; quiz?: number }
}

export interface LessonDrill {
  type: 'gap_fill' | 'transform' | 'reorder'
  prompt: string
  answer: string
  hint?: string
}

export interface DailyPlan {
  flashcardCount: number
  coachMode: ChatMode
  coachPrompt: string
  immersionTask: string
  videoTask: string
  estimatedMinutes: number
}

export interface TeachingBlock {
  goals: string[]
  explanationMd: string
  keyPatterns: string[]
  commonMistakes: string[]
}

export interface DailyLessonSections {
  teaching: TeachingBlock
  words: Array<{ word: string; translation: string; ipa?: string; example: string }>
  grammarRules: Array<{ rule: string; explanation: string; examples: string[] }>
  drills: LessonDrill[]
  dialogues: Array<{ context: string; lines: string[] }>
  reading: { title: string; text: string; questions: string[] }
  speakingExercise: { prompt: string; hints: string[] }
  writingExercise: { prompt: string; minSentences: number }
  quiz: Array<{ question: string; options?: string[]; answer: string }>
  dailyPlan: DailyPlan
  youtubeUrl: string
  immersion: { films: string[]; books: string[]; why: string }
}

export async function generateDailyLesson(input: DailyLessonInput): Promise<{
  sections: DailyLessonSections
  contentMd: string
}> {
  const explainIn = EXPLAIN_LANG[input.locale] ?? 'English'
  const target = LANG_NAMES[input.language]
  const avg =
    ((input.recentScores?.quiz ?? input.recentScores?.vocab ?? 70) +
      (input.recentScores?.grammar ?? 70)) /
    2
  const difficulty =
    avg >= 85 ? 'intensive — pack more patterns, slightly above yesterday'
    : avg >= 70 ? 'solid A1 pace — teach two grammar points thoroughly'
    : 'clear beginner — still pack a full institute day'

  let sections = defaultLesson(input)

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const raw = await createClaudeMessage({
        system: `You are an intensive ${target} institute teacher (Alliance Française / Instituto Cervantes / Arabic institute style).
Create ONE daily A1 lesson (~40–45 minutes). Teach FIRST, then practice, then test. Never start with a quiz.
Explain teaching + grammar in ${explainIn}. Target-language examples, dialogues, reading, drills in ${target}.
Difficulty: ${difficulty}.

Return JSON only matching DailyLessonSections:
- teaching: { goals: string[3-5], explanationMd: markdown mini-lesson (what/why/how), keyPatterns: string[4-6], commonMistakes: string[3-5] }
- words: exactly 15–20 items {word, translation, ipa?, example}
- grammarRules: exactly 2 dense points {rule, explanation, examples: string[4-6]}
- drills: 6–8 controlled items {type: gap_fill|transform|reorder, prompt, answer, hint?}
- dialogues: 5 short snippets {context, lines[]}
- reading: {title, text ~100-120 words, questions: string[3]}
- speakingExercise: {prompt, hints[]}
- writingExercise: {prompt, minSentences: 4}
- quiz: exactly 8 questions {question, options?, answer} — only after teaching concepts
- dailyPlan: {flashcardCount: 12-15, coachMode: friend|pronunciation|voice_coach|grammar, coachPrompt: one concrete task, immersionTask: one scene/paragraph task, videoTask: what to watch for, estimatedMinutes: 40-45}
- youtubeUrl, immersion may be placeholders (server overwrites)

Pack more into one day than a casual app. Be systematic and clear.`,
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
        maxTokens: 8000,
        temperature: 0.4,
      })
      const parsed = JSON.parse(extractJson(raw)) as Partial<DailyLessonSections>
      if (parsed.words?.length || parsed.teaching?.explanationMd) {
        sections = normalizeSections({ ...sections, ...parsed }, input)
      }
    } catch {
      // defaults
    }
  }

  const contentMd = lessonToMarkdown(sections, input)
  return { sections, contentMd }
}

function normalizeSections(
  s: Partial<DailyLessonSections> & { youtubeUrl?: string },
  input: DailyLessonInput,
): DailyLessonSections {
  const base = defaultLesson(input)
  return {
    teaching: {
      goals: s.teaching?.goals?.length ? s.teaching.goals : base.teaching.goals,
      explanationMd: s.teaching?.explanationMd || base.teaching.explanationMd,
      keyPatterns: s.teaching?.keyPatterns ?? base.teaching.keyPatterns,
      commonMistakes: s.teaching?.commonMistakes ?? base.teaching.commonMistakes,
    },
    words: s.words?.length ? s.words : base.words,
    grammarRules: s.grammarRules?.length ? s.grammarRules : base.grammarRules,
    drills: s.drills?.length ? s.drills : base.drills,
    dialogues: s.dialogues?.length ? s.dialogues : base.dialogues,
    reading: s.reading?.text ? s.reading : base.reading,
    speakingExercise: s.speakingExercise ?? base.speakingExercise,
    writingExercise: s.writingExercise ?? base.writingExercise,
    quiz: s.quiz?.length ? s.quiz : base.quiz,
    dailyPlan: {
      flashcardCount: s.dailyPlan?.flashcardCount ?? base.dailyPlan.flashcardCount,
      coachMode: s.dailyPlan?.coachMode ?? base.dailyPlan.coachMode,
      coachPrompt: s.dailyPlan?.coachPrompt ?? base.dailyPlan.coachPrompt,
      immersionTask: s.dailyPlan?.immersionTask ?? base.dailyPlan.immersionTask,
      videoTask: s.dailyPlan?.videoTask ?? base.dailyPlan.videoTask,
      estimatedMinutes: s.dailyPlan?.estimatedMinutes ?? base.dailyPlan.estimatedMinutes,
    },
    youtubeUrl: input.youtubeUrl,
    immersion: s.immersion ?? base.immersion,
  }
}

function defaultLesson(input: DailyLessonInput): DailyLessonSections {
  return {
    teaching: {
      goals: [
        `Understand today's topic: ${input.topic}`,
        `Use the grammar focus: ${input.grammarFocus}`,
        'Produce 4+ simple sentences aloud and in writing',
      ],
      explanationMd: `## ${input.topic}\n\nToday we focus on **${input.grammarFocus}**. Read the patterns, study the words, then practice before the quiz.`,
      keyPatterns: [input.grammarFocus],
      commonMistakes: ['Mixing word order', 'Forgetting agreement', 'Translating word-for-word from your native language'],
    },
    words: [],
    grammarRules: [
      { rule: input.grammarFocus, explanation: 'See the teaching section.', examples: [] },
      { rule: 'Core phrase patterns', explanation: 'Reuse patterns from dialogues.', examples: [] },
    ],
    drills: [],
    dialogues: [],
    reading: { title: input.topic, text: '', questions: [] },
    speakingExercise: {
      prompt: `Speak for 1–2 minutes about "${input.topic}" in ${LANG_NAMES[input.language]}.`,
      hints: ['Use today\'s words', 'Reuse one grammar pattern'],
    },
    writingExercise: {
      prompt: `Write 4 sentences about "${input.topic}" using today's grammar.`,
      minSentences: 4,
    },
    quiz: [],
    dailyPlan: {
      flashcardCount: 14,
      coachMode: 'grammar',
      coachPrompt: `Drill me on ${input.grammarFocus} with 5 short questions.`,
      immersionTask: 'Watch or read one immersion item and note 3 new words.',
      videoTask: 'Watch the lesson video and repeat 3 key sentences aloud.',
      estimatedMinutes: 45,
    },
    youtubeUrl: input.youtubeUrl,
    immersion: { films: [], books: [], why: 'Build immersion habit.' },
  }
}

function lessonToMarkdown(s: DailyLessonSections, input: DailyLessonInput): string {
  const lines = [
    `# ${LANG_NAMES[input.language]} · Day ${input.programDay} · Institute day`,
    `**${input.topic}** (~${s.dailyPlan.estimatedMinutes} min)`,
    '',
    '## Teach — goals',
    ...s.teaching.goals.map((g) => `- ${g}`),
    '',
    s.teaching.explanationMd,
    '',
    '## Key patterns',
    ...s.teaching.keyPatterns.map((p) => `- ${p}`),
    '',
    '## Common mistakes',
    ...s.teaching.commonMistakes.map((m) => `- ${m}`),
    '',
    `## Words (${s.words.length})`,
    ...s.words.map((w) => `- **${w.word}** — ${w.translation}${w.ipa ? ` [${w.ipa}]` : ''}\n  ${w.example}`),
    '',
    '## Grammar',
    ...s.grammarRules.flatMap((g) => [
      `### ${g.rule}`,
      g.explanation,
      ...g.examples.map((e) => `- ${e}`),
      '',
    ]),
    '## Drills',
    ...s.drills.map((d, i) => `${i + 1}. [${d.type}] ${d.prompt}`),
    '',
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
    '## Daily plan',
    `- Video: ${s.dailyPlan.videoTask}`,
    `- Coach (${s.dailyPlan.coachMode}): ${s.dailyPlan.coachPrompt}`,
    `- Flashcards: ${s.dailyPlan.flashcardCount}`,
    `- Immersion: ${s.dailyPlan.immersionTask}`,
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
      maxTokens: 3500,
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
