import { NextResponse } from 'next/server'
import { generateWeeklyReport } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { fetchTutorSettings } from '@/lib/language-tutor/lesson'
import { streakDays } from '@/lib/language-tutor/rotation'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await fetchTutorSettings(supabase, user.id)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const weekKey = weekStart.toISOString().slice(0, 10)

  const [{ data: errors }, { data: lessons }] = await Promise.all([
    supabase
      .from('language_tutor_errors')
      .select('language, mistake, correction, count')
      .eq('user_id', user.id)
      .order('count', { ascending: false })
      .limit(15),
    supabase
      .from('language_tutor_lessons')
      .select('language, status, scores, lesson_date')
      .eq('user_id', user.id)
      .gte('lesson_date', weekKey),
  ])

  const completed = (lessons ?? []).filter((l) => l.status === 'done')
  const doneDates = completed.map((l) => l.lesson_date as string)

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
    byLanguage: {},
  })

  const { data: saved, error } = await supabase
    .from('language_tutor_reports')
    .upsert(
      {
        user_id: user.id,
        week_start: weekKey,
        content_md: report.contentMd,
        sections: report.sections,
      },
      { onConflict: 'user_id,week_start' },
    )
    .select('*')
    .single()

  if (error) {
    if (isMissingLanguageTutorTable(error)) {
      return NextResponse.json({ error: 'language_tutor_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ report: saved })
}
