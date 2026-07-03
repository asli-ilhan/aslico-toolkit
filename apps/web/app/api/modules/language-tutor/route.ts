import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { fetchTutorSettings } from '@/lib/language-tutor/lesson'
import { languageForDate, programDayIndex, streakDays } from '@/lib/language-tutor/rotation'
import { languageLabel } from '@/lib/language-tutor/rotation'
import { languageDayIndex } from '@/lib/language-tutor/curriculum'
import { gatedUnitForLanguageDay } from '@/lib/language-tutor/progress'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const settings = await fetchTutorSettings(supabase, user.id)
  const schedule = languageForDate(new Date(), settings.rotation, settings.sundayBreak)

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
      .select('lesson_date')
      .eq('user_id', user.id)
      .eq('status', 'done'),
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

  const completedDates = (doneRes.data ?? []).map((d) => d.lesson_date as string)
  const programDay = programDayIndex(settings.programStartDate)

  const langDay =
    schedule.language ?
      languageDayIndex(
        settings.programStartDate,
        schedule.language,
        new Date(),
        settings.rotation,
      )
    : 1
  const grammarProgress = (grammarRes.data ?? []) as Array<{
    topic_id: string
    mastery_score: number
    passed: boolean
  }>
  const gated =
    schedule.language ?
      gatedUnitForLanguageDay(schedule.language, langDay, grammarProgress)
    : null
  const currentUnit = gated?.unit ?? null
  const currentGrammar = currentUnit ?
    grammarProgress.find((g) => g.topic_id === currentUnit.id) ?? null
  : null

  return NextResponse.json({
    settings,
    schedule: {
      ...schedule,
      languageLabel: schedule.language ? languageLabel(schedule.language, settings.nativeLanguage === 'tr' ? 'tr' : 'en') : null,
      programDay,
      goalDays: settings.goalDays,
      streak: streakDays(completedDates, settings.sundayBreak),
      currentUnit: currentUnit ?
        {
          id: currentUnit.id,
          topic: currentUnit.topic,
          grammarFocus: currentUnit.grammarFocus,
          repeatUnit: gated?.repeatUnit ?? false,
        }
      : null,
      grammarMastery: currentGrammar,
      grammarGateOpen: currentGrammar?.passed ?? false,
    },
    todayLesson: lessonRes.data,
    dueFlashcards: dueCardsRes.data ?? [],
    topErrors: errorsRes.data ?? [],
    latestReport: reportRes.data,
  })
}
