import type { SupabaseClient } from '@supabase/supabase-js'
import { generateWeeklyReport } from '@aslico/ai'
import { fetchTutorSettings } from './lesson'
import { streakDays } from './rotation'

/** Aggregate errors and refresh weekly report (nightly / Sunday). */
export async function runErrorAnalysis(supabase: SupabaseClient, userId: string) {
  const settings = await fetchTutorSettings(supabase, userId)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const weekKey = weekStart.toISOString().slice(0, 10)

  const [{ data: errors }, { data: lessons }] = await Promise.all([
    supabase
      .from('language_tutor_errors')
      .select('language, mistake, correction, count')
      .eq('user_id', userId)
      .order('count', { ascending: false })
      .limit(20),
    supabase
      .from('language_tutor_lessons')
      .select('language, status, lesson_date')
      .eq('user_id', userId)
      .gte('lesson_date', weekKey),
  ])

  const completed = (lessons ?? []).filter((l) => l.status === 'done')
  const doneDates = completed.map((l) => l.lesson_date as string)

  const byLanguage: Record<string, { lessons: number; avgScore: number }> = {}
  for (const lang of ['fr', 'es', 'ar']) {
    const langLessons = completed.filter((l) => l.language === lang)
    byLanguage[lang] = { lessons: langLessons.length, avgScore: 0 }
  }

  const report = await generateWeeklyReport({
    locale: settings.nativeLanguage,
    errors: (errors ?? []).map((e) => ({
      language: e.language as string,
      mistake: e.mistake as string,
      correction: e.correction as string,
      count: e.count as number,
    })),
    lessonsCompleted: completed.length,
    streak: streakDays(doneDates, settings.sundayBreak),
    byLanguage,
  })

  await supabase.from('language_tutor_reports').upsert(
    {
      user_id: userId,
      week_start: weekKey,
      content_md: report.contentMd,
      sections: { ...report.sections, analyzedAt: new Date().toISOString() },
    },
    { onConflict: 'user_id,week_start' },
  )

  return {
    topErrorCount: errors?.length ?? 0,
    lessonsCompleted: completed.length,
    weekKey,
  }
}
