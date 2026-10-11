import type { SupabaseClient } from '@supabase/supabase-js'
import { generateDailyLesson, generateFlashcardsFromWords } from '@aslico/ai'
import {
  nextUnitFromProgress,
  programDayFromCompleted,
} from '@/lib/language-tutor/progress'
import { youtubePlaylistForUnit } from '@/lib/language-tutor/youtube'
import { fetchImmersionBundle } from '@/lib/language-tutor/immersion'
import { languageForCalendarDate, type TutorLanguage } from '@/lib/language-tutor/rotation'
import { calendarDateInTimeZone, resolveLessonDate } from '@/lib/language-tutor/dates'

export interface TutorSettings {
  programStartDate: string
  goalDays: number
  rotation: TutorLanguage[]
  sundayBreak: boolean
  nativeLanguage: string
  level: string
}

export async function fetchTutorSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<TutorSettings> {
  const { data } = await supabase
    .from('language_tutor_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  const today = calendarDateInTimeZone()
  return {
    programStartDate: (data?.program_start_date as string | undefined) ?? today,
    goalDays: (data?.goal_days as number | undefined) ?? 90,
    rotation: ((data?.rotation as string[] | undefined)?.length ?
        data!.rotation
      : ['fr', 'es', 'ar']) as TutorLanguage[],
    sundayBreak: data?.sunday_break ?? false,
    nativeLanguage: (data?.native_language as string | undefined) ?? 'tr',
    level: (data?.level as string | undefined) ?? 'beginner',
  }
}

function stubSections(input: {
  topic: string
  grammarFocus: string
  youtubeUrl: string
  language: TutorLanguage
  track: 'a1' | 'a2_crash'
  repeatUnit: boolean
  unitId: string
  languageDay: number
}) {
  const isA2 = input.track === 'a2_crash'
  return {
    teaching: {
      goals: [
        `Understand today's topic: ${input.topic}`,
        `Use the grammar focus: ${input.grammarFocus}`,
        isA2
          ? 'Produce 5+ connected A2 sentences aloud and in writing'
          : 'Produce 4+ simple sentences aloud and in writing',
      ],
      explanationMd: `## ${input.topic}\n\nToday we focus on **${input.grammarFocus}**. Full institute content is loading — refresh if this stays empty.`,
      keyPatterns: [input.grammarFocus],
      commonMistakes: [
        'Mixing word order',
        'Forgetting agreement',
        'Translating word-for-word from your native language',
      ],
    },
    words: [] as Array<{ word: string; translation: string; ipa?: string; example: string }>,
    grammarRules: [
      { rule: input.grammarFocus, explanation: 'See the teaching section.', examples: [] as string[] },
      { rule: 'Core phrase patterns', explanation: 'Reuse patterns from dialogues.', examples: [] as string[] },
    ],
    drills: [] as Array<{ type: 'gap_fill' | 'transform' | 'reorder'; prompt: string; answer: string; hint?: string }>,
    dialogues: [] as Array<{ context: string; lines: string[] }>,
    reading: { title: input.topic, text: '', questions: [] as string[] },
    speakingExercise: {
      prompt: `Speak for 1–2 minutes about "${input.topic}".`,
      hints: ["Use today's words", 'Reuse one grammar pattern'],
    },
    writingExercise: {
      prompt: `Write ${isA2 ? 5 : 4} sentences about "${input.topic}" using today's grammar.`,
      minSentences: isA2 ? 5 : 4,
    },
    quiz: [] as Array<{ question: string; options: string[]; answer: string }>,
    dailyPlan: {
      flashcardCount: isA2 ? 16 : 14,
      coachMode: 'grammar' as 'friend' | 'pronunciation' | 'voice_coach' | 'grammar',
      coachPrompt: `Drill me on ${input.grammarFocus} with 5 short questions.`,
      immersionTask: isA2
        ? 'Watch or read one A2 immersion item; note 5 new words and one connector.'
        : 'Watch or read one immersion item and note 3 new words.',
      videoTask: 'Watch the lesson video and repeat 3 key sentences aloud.',
      estimatedMinutes: 45,
    },
    youtubeUrl: input.youtubeUrl,
    immersion: { films: [] as string[], books: [] as string[], why: 'Build immersion habit.' },
    repeatUnit: input.repeatUnit,
    unitId: input.unitId,
    languageDay: input.languageDay,
  }
}

type LessonSectionsRow = ReturnType<typeof stubSections>

export async function generateTodayLesson(
  supabase: SupabaseClient,
  userId: string,
  locale: string,
  lessonDateInput?: string | null,
) {
  const settings = await fetchTutorSettings(supabase, userId)
  const lessonDate = resolveLessonDate(lessonDateInput ?? calendarDateInTimeZone())
  const { language, isRestDay } = languageForCalendarDate(
    lessonDate,
    settings.rotation,
    settings.sundayBreak,
  )

  if (isRestDay || !language) {
    return { restDay: true as const, lessonDate }
  }

  const [{ data: grammarRows }, { count: doneCount }] = await Promise.all([
    supabase
      .from('language_tutor_grammar_progress')
      .select('topic_id, mastery_score, passed')
      .eq('user_id', userId)
      .eq('language', language),
    supabase
      .from('language_tutor_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'done'),
  ])

  const programDay = programDayFromCompleted(doneCount ?? 0, settings.goalDays)
  const { unit, repeatUnit, languageDay } = nextUnitFromProgress(
    language,
    (grammarRows ?? []) as Array<{ topic_id: string; mastery_score: number; passed: boolean }>,
  )
  const youtubeUrl = youtubePlaylistForUnit(unit.id, unit.youtubeTopic, language)
  const track = language === 'fr' ? ('a2_crash' as const) : ('a1' as const)

  // Persist a stub FIRST so a long Claude call / timeout never leaves "no lesson".
  const immersionBundle = await fetchImmersionBundle(supabase, userId, language, unit)
  const stub = stubSections({
    topic: unit.topic,
    grammarFocus: unit.grammarFocus,
    youtubeUrl,
    language,
    track,
    repeatUnit,
    unitId: unit.id,
    languageDay,
  })
  stub.immersion = {
    films: immersionBundle.films,
    books: [...immersionBundle.books, ...immersionBundle.cultureBooks.map((b) => b.title)],
    why: immersionBundle.why,
  }

  const { data: saved, error: upsertErr } = await supabase
    .from('language_tutor_lessons')
    .upsert(
      {
        user_id: userId,
        lesson_date: lessonDate,
        language,
        program_day: programDay,
        topic: unit.topic,
        status: 'pending',
        sections: stub,
        youtube_url: youtubeUrl,
        scores: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_date' },
    )
    .select('*')
    .single()

  if (upsertErr) throw upsertErr
  if (!saved) throw new Error('Lesson upsert returned no row')

  const { data: prevLesson } = await supabase
    .from('language_tutor_lessons')
    .select('scores')
    .eq('user_id', userId)
    .eq('language', language)
    .eq('status', 'done')
    .order('lesson_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  let sections: LessonSectionsRow = stub
  let contentMd = `# ${unit.topic}\n\n${unit.grammarFocus}`

  try {
    const generated = await generateDailyLesson({
      language,
      locale: settings.nativeLanguage || locale,
      programDay: languageDay,
      topic: unit.topic,
      grammarFocus: unit.grammarFocus,
      youtubeUrl,
      track,
      recentScores: (prevLesson?.scores as Record<string, number> | undefined) ?? undefined,
    })
    sections = {
      ...generated.sections,
      immersion: stub.immersion,
      youtubeUrl,
      repeatUnit,
      unitId: unit.id,
      languageDay,
    } satisfies LessonSectionsRow
    contentMd = generated.contentMd

    const { data: enriched, error: updateErr } = await supabase
      .from('language_tutor_lessons')
      .update({
        sections,
        youtube_url: youtubeUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', saved.id)
      .select('*')
      .single()

    if (updateErr) throw updateErr

    await supabase.from('language_tutor_flashcards').delete().eq('source_lesson_id', saved.id)

    if (sections.words.length > 0) {
      const targetCount = Math.min(
        sections.words.length,
        Math.max(12, sections.dailyPlan?.flashcardCount ?? 14),
      )
      const wordsForCards = sections.words.slice(0, targetCount)
      const cards = await generateFlashcardsFromWords(
        language,
        wordsForCards.map((w) => ({ word: w.word, translation: w.translation })),
        settings.nativeLanguage,
      )
      for (const card of cards) {
        await supabase.from('language_tutor_flashcards').insert({
          user_id: userId,
          language,
          word: card.word,
          translation: card.translation,
          ipa: card.ipa,
          example_sentence: card.example_sentence,
          synonyms: card.synonyms,
          antonyms: card.antonyms,
          source_lesson_id: saved.id,
          next_review_at: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        })
      }
    }

    await ensurePracticeTodo(supabase, userId, language, lessonDate)

    return {
      restDay: false as const,
      lesson: enriched ?? { ...saved, sections },
      contentMd,
      language,
      programDay,
      goalDays: settings.goalDays,
      unit,
      repeatUnit,
    }
  } catch (enrichErr) {
    // Stub already saved — return it so the UI is not empty.
    console.error('[language-tutor] enrich failed, returning stub lesson', enrichErr)
    await ensurePracticeTodo(supabase, userId, language, lessonDate)
    return {
      restDay: false as const,
      lesson: saved,
      contentMd,
      language,
      programDay,
      goalDays: settings.goalDays,
      unit,
      repeatUnit,
      enrichFailed: true as const,
    }
  }
}

async function ensurePracticeTodo(
  supabase: SupabaseClient,
  userId: string,
  language: TutorLanguage,
  date: string,
) {
  const labels: Record<TutorLanguage, string> = {
    fr: 'French A2 crash day (~45min)',
    es: 'Spanish Institute day (~45min)',
    ar: 'Arabic Institute day (~45min)',
  }
  try {
    const { data: existing } = await supabase
      .from('calendar_todos')
      .select('id')
      .eq('user_id', userId)
      .eq('due_date', date)
      .ilike('title', `%${labels[language].split(' ')[0]}%`)
      .maybeSingle()
    if (!existing) {
      await supabase.from('calendar_todos').insert({
        user_id: userId,
        title: labels[language],
        due_date: date,
        done: false,
      })
    }
  } catch {
    // calendar optional
  }
}
