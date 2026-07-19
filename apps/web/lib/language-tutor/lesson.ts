import type { SupabaseClient } from '@supabase/supabase-js'
import { generateDailyLesson, generateFlashcardsFromWords } from '@aslico/ai'
import { languageDayIndex } from '@/lib/language-tutor/curriculum'
import { gatedUnitForLanguageDay } from '@/lib/language-tutor/progress'
import { youtubePlaylistForUnit } from '@/lib/language-tutor/youtube'
import { fetchImmersionBundle } from '@/lib/language-tutor/immersion'
import { languageForDate, programDayIndex, type TutorLanguage } from '@/lib/language-tutor/rotation'

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

  const today = new Date().toISOString().slice(0, 10)
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

export async function generateTodayLesson(
  supabase: SupabaseClient,
  userId: string,
  locale: string,
) {
  const settings = await fetchTutorSettings(supabase, userId)
  const today = new Date()
  const lessonDate = today.toISOString().slice(0, 10)
  const { language, isRestDay } = languageForDate(today, settings.rotation, settings.sundayBreak)

  if (isRestDay || !language) {
    return { restDay: true as const, lessonDate }
  }

  const programDay = programDayIndex(settings.programStartDate, today, settings.sundayBreak)
  const langDay = languageDayIndex(
    settings.programStartDate,
    language,
    today,
    settings.rotation,
    settings.sundayBreak,
  )

  const { data: grammarRows } = await supabase
    .from('language_tutor_grammar_progress')
    .select('topic_id, mastery_score, passed')
    .eq('user_id', userId)
    .eq('language', language)

  const { unit, repeatUnit } = gatedUnitForLanguageDay(
    language,
    langDay,
    (grammarRows ?? []) as Array<{ topic_id: string; mastery_score: number; passed: boolean }>,
  )
  const youtubeUrl = youtubePlaylistForUnit(unit.id, unit.youtubeTopic, language)

  const { data: prevLesson } = await supabase
    .from('language_tutor_lessons')
    .select('scores')
    .eq('user_id', userId)
    .eq('language', language)
    .eq('status', 'done')
    .order('lesson_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { sections, contentMd } = await generateDailyLesson({
    language,
    locale: settings.nativeLanguage || locale,
    programDay,
    topic: unit.topic,
    grammarFocus: unit.grammarFocus,
    youtubeUrl,
    recentScores: (prevLesson?.scores as Record<string, number> | undefined) ?? undefined,
  })

  const immersionBundle = await fetchImmersionBundle(supabase, userId, language, unit)
  sections.immersion = {
    films: immersionBundle.films,
    books: [...immersionBundle.books, ...immersionBundle.cultureBooks.map((b) => b.title)],
    why: immersionBundle.why,
  }
  sections.youtubeUrl = youtubeUrl

  const { data: saved, error } = await supabase
    .from('language_tutor_lessons')
    .upsert(
      {
        user_id: userId,
        lesson_date: lessonDate,
        language,
        program_day: programDay,
        topic: unit.topic,
        status: 'pending',
        sections: { ...sections, repeatUnit, unitId: unit.id },
        youtube_url: youtubeUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_date' },
    )
    .select('*')
    .single()

  if (error) throw error

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

  return { restDay: false as const, lesson: saved, contentMd, language, programDay, goalDays: settings.goalDays, unit, repeatUnit }
}

async function ensurePracticeTodo(
  supabase: SupabaseClient,
  userId: string,
  language: TutorLanguage,
  date: string,
) {
  const labels: Record<TutorLanguage, string> = {
    fr: 'French Institute day (~45min)',
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
