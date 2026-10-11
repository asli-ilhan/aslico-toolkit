import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { fetchTutorSettings } from '@/lib/language-tutor/lesson'
import { languageForCalendarDate, languageLabel, streakDays } from '@/lib/language-tutor/rotation'
import {
  isUnitPassedByScore,
  nextUnitFromProgress,
  programDayFromCompleted,
  unitsForLanguage,
} from '@/lib/language-tutor/progress'
import { calendarDateInTimeZone, resolveLessonDate } from '@/lib/language-tutor/dates'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const today = resolveLessonDate(url.searchParams.get('local_date') ?? calendarDateInTimeZone())
  const settings = await fetchTutorSettings(supabase, user.id)
  const schedule = languageForCalendarDate(today, settings.rotation, settings.sundayBreak)

  const [lessonRes, dueCardsRes, doneRes, errorsRes, reportRes, grammarRes] = await Promise.all([
    supabase
      .from('language_tutor_lessons')
      .select('*')
      .eq('user_id', user.id)
      .eq('lesson_date', today)
      .maybeSingle(),
    supabase
      .from('language_tutor_flashcards')
      .select('id, language, word, translation, ipa, example_sentence, next_review_at')
      .eq('user_id', user.id)
      .lte('next_review_at', today)
      .order('next_review_at', { ascending: true })
      .limit(20),
    supabase
      .from('language_tutor_lessons')
      .select('lesson_date, language, scores, topic, status')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('lesson_date', { ascending: true }),
    supabase
      .from('language_tutor_errors')
      .select('language, mistake, correction, count')
      .eq('user_id', user.id)
      .order('count', { ascending: false })
      .limit(10),
    supabase
      .from('language_tutor_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    schedule.language ?
      supabase
        .from('language_tutor_grammar_progress')
        .select('topic_id, mastery_score, passed')
        .eq('user_id', user.id)
        .eq('language', schedule.language)
    : Promise.resolve({ data: [], error: null }),
  ])

  const err = lessonRes.error ?? dueCardsRes.error
  if (err && isMissingLanguageTutorTable(err)) {
    return NextResponse.json({ warning: 'language_tutor_table_missing' })
  }

  let todayLesson = lessonRes.data
  if (!todayLesson && schedule.language) {
    const { data: openLesson } = await supabase
      .from('language_tutor_lessons')
      .select('*')
      .eq('user_id', user.id)
      .eq('language', schedule.language)
      .in('status', ['pending', 'in_progress'])
      .order('lesson_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    todayLesson = openLesson
  }

  const doneLessons = doneRes.data ?? []
  const completedDates = doneLessons.map((d) => d.lesson_date as string)
  const completedCount = doneLessons.length
  const programDay = programDayFromCompleted(completedCount, settings.goalDays)

  const completedByLanguage: Record<string, number> = { fr: 0, es: 0, ar: 0 }
  for (const row of doneLessons) {
    const lang = String(row.language ?? '')
    if (lang in completedByLanguage) completedByLanguage[lang] += 1
  }

  const grammarProgress = (grammarRes.data ?? []) as Array<{
    topic_id: string
    mastery_score: number
    passed: boolean
  }>

  const gated =
    schedule.language ? nextUnitFromProgress(schedule.language, grammarProgress) : null
  const currentUnit = gated?.unit ?? null
  const currentGrammar = currentUnit
    ? grammarProgress.find((g) => g.topic_id === currentUnit.id) ?? null
    : null
  const todayScores = todayLesson?.scores as { quiz?: number } | null | undefined
  const checkComplete = typeof todayScores?.quiz === 'number'
  const checkAcknowledged =
    (todayLesson?.sections as { checkAcknowledged?: boolean } | null | undefined)
      ?.checkAcknowledged === true
  const grammarGateOpen =
    (currentGrammar?.passed ?? false) ||
    isUnitPassedByScore(todayScores?.quiz) ||
    checkAcknowledged

  const unitsTotal = schedule.language ? unitsForLanguage(schedule.language).length : 0
  const recentDone = doneLessons
    .slice(-8)
    .reverse()
    .map((d) => ({
      date: d.lesson_date as string,
      language: d.language as string,
      topic: d.topic as string,
      quiz: (d.scores as { quiz?: number } | null)?.quiz ?? null,
    }))

  return NextResponse.json({
    settings,
    schedule: {
      ...schedule,
      languageLabel: schedule.language
        ? languageLabel(schedule.language, settings.nativeLanguage === 'tr' ? 'tr' : 'en')
        : null,
      /** Advances only when lessons are marked done. */
      programDay,
      languageDay: gated?.languageDay ?? 1,
      goalDays: settings.goalDays,
      streak: streakDays(completedDates, settings.sundayBreak),
      currentUnit: currentUnit
        ? {
            id: currentUnit.id,
            topic: currentUnit.topic,
            grammarFocus: currentUnit.grammarFocus,
            repeatUnit: gated?.repeatUnit ?? false,
          }
        : null,
      grammarMastery: currentGrammar,
      grammarGateOpen,
      checkComplete,
      checkAcknowledged,
      quizPassThreshold: 70,
      lessonDate: today,
    },
    progress: {
      completedCount,
      goalDays: settings.goalDays,
      completedByLanguage,
      unitsPassed: gated?.unitsPassed ?? 0,
      unitsTotal,
      languageDay: gated?.languageDay ?? 1,
      lastQuizScore: todayScores?.quiz ?? recentDone[0]?.quiz ?? null,
      recentDone,
    },
    todayLesson,
    dueFlashcards: dueCardsRes.data ?? [],
    topErrors: errorsRes.data ?? [],
    latestReport: reportRes.data,
  })
}
