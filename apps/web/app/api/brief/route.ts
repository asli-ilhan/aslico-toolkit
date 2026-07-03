import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchJobBrief,
  fetchNewsletterInterests,
  fetchTodayCalendar,
} from '@/lib/toolkit-context'

/** Unified dashboard brief: job agent + calendar + newsletter */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const jobBrief = await fetchJobBrief(supabase, user.id)
  const todayEvents = await fetchTodayCalendar(supabase, user.id)
  const interests = await fetchNewsletterInterests(supabase, user.id)

  const { data: newsletter } = await supabase
    .from('newsletter_issues')
    .select('id, title, issue_date, sections')
    .eq('user_id', user.id)
    .eq('issue_date', today)
    .maybeSingle()

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
    deadlines: jobBrief.deadlines,
    followUps: jobBrief.followUps,
    todayEvents,
    weekEvents: weekEvents ?? [],
    newsletter,
    interests: interests.length ? interests : null,
  })
}
