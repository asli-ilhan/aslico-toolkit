import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchJobBrief,
  fetchNewsletterInterests,
  fetchTodayCalendar,
  fetchTodayTodos,
} from '@/lib/toolkit-context'
import { fetchTutorSettings } from '@/lib/language-tutor/lesson'
import { languageForDate, languageLabel, programDayIndex } from '@/lib/language-tutor/rotation'

/** Unified dashboard brief: job agent + calendar + newsletter + learning */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const jobBrief = await fetchJobBrief(supabase, user.id)
  const todayEvents = await fetchTodayCalendar(supabase, user.id)
  const todayTodos = await fetchTodayTodos(supabase, user.id, today)
  const interests = await fetchNewsletterInterests(supabase, user.id)

  const [newsletterRes, cultureRes, languageRes, travelRes, fundingPendingRes, fundingDeadlinesRes] = await Promise.all([
    supabase
      .from('newsletter_issues')
      .select('id, title, issue_date, sections')
      .eq('user_id', user.id)
      .eq('issue_date', today)
      .maybeSingle(),
    supabase
      .from('culture_tracker_scouts')
      .select('id, title, scout_date, sections')
      .eq('user_id', user.id)
      .eq('scout_date', today)
      .maybeSingle(),
    supabase
      .from('language_tutor_lessons')
      .select('id, topic, language, status')
      .eq('user_id', user.id)
      .eq('lesson_date', today)
      .maybeSingle(),
    supabase
      .from('travel_scout_plans')
      .select('id, destination, start_date, end_date')
      .eq('user_id', user.id)
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('funding_applications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending_review'),
    supabase
      .from('funding_applications')
      .select('id, funder, title, deadline')
      .eq('user_id', user.id)
      .not('deadline', 'is', null)
      .gte('deadline', today)
      .in('status', ['pending_review', 'approved', 'submitted'])
      .order('deadline', { ascending: true })
      .limit(5),
  ])

  const newsletter = newsletterRes.data
  const cultureScout = cultureRes.data

  let languageTutor: {
    isRestDay: boolean
    language: string | null
    languageLabel: string | null
    topic: string | null
    status: string | null
    programDay: number
  } | null = null

  try {
    const settings = await fetchTutorSettings(supabase, user.id)
    const schedule = languageForDate(new Date(), settings.rotation, settings.sundayBreak)
    const explainLocale = settings.nativeLanguage === 'tr' ? 'tr' : 'en'
    languageTutor = {
      isRestDay: schedule.isRestDay,
      language: schedule.language,
      languageLabel:
        schedule.language ? languageLabel(schedule.language, explainLocale) : null,
      topic: (languageRes.data?.topic as string | undefined) ?? null,
      status: (languageRes.data?.status as string | undefined) ?? null,
      programDay: programDayIndex(settings.programStartDate, new Date(), settings.sundayBreak),
    }
  } catch {
    languageTutor = null
  }

  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const { data: weekEvents } = await supabase
    .from('calendar_events')
    .select('id, title, starts_at, all_day, source')
    .eq('user_id', user.id)
    .gte('starts_at', new Date().toISOString())
    .lte('starts_at', weekEnd.toISOString())
    .order('starts_at', { ascending: true })
    .limit(8)

  return NextResponse.json({
    pendingCount: jobBrief.pendingCount,
    fundingPendingCount: fundingPendingRes.count ?? 0,
    fundingDeadlines: fundingDeadlinesRes.data ?? [],
    deadlines: jobBrief.deadlines,
    followUps: jobBrief.followUps,
    todayEvents,
    todayTodos,
    weekEvents: weekEvents ?? [],
    newsletter,
    cultureScout,
    languageTutor,
    upcomingTrip: travelRes.data,
    interests: interests.length ? interests : null,
  })
}
