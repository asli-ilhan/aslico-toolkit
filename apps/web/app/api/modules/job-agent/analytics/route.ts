import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: packs } = await supabase
    .from('application_packs')
    .select('status, funnel_stage, fit_score, created_at, submitted_at')
    .eq('user_id', user.id)

  const { data: events } = await supabase
    .from('application_events')
    .select('event_type, created_at')
    .eq('user_id', user.id)

  const items = packs ?? []
  const total = items.length
  const submitted = items.filter((p) => p.status === 'submitted' || p.funnel_stage === 'applied').length
  const interviews = items.filter((p) => p.funnel_stage === 'interview').length
  const offers = items.filter((p) => p.funnel_stage === 'offer').length
  const rejected = items.filter((p) => p.funnel_stage === 'rejected').length
  const pending = items.filter((p) => p.status === 'pending_review').length
  const avgFit =
    items.filter((p) => p.fit_score != null).reduce((s, p) => s + (p.fit_score ?? 0), 0) /
      Math.max(1, items.filter((p) => p.fit_score != null).length) || 0

  const conversion = {
    submitRate: total ? Math.round((submitted / total) * 100) : 0,
    interviewRate: submitted ? Math.round((interviews / submitted) * 100) : 0,
    offerRate: interviews ? Math.round((offers / interviews) * 100) : 0,
  }

  const { data: deadlines } = await supabase
    .from('application_packs')
    .select('id, company, role, deadline_at')
    .eq('user_id', user.id)
    .not('deadline_at', 'is', null)
    .gte('deadline_at', new Date().toISOString())
    .order('deadline_at', { ascending: true })
    .limit(5)

  const { data: followUps } = await supabase
    .from('application_packs')
    .select('id, company, role, follow_up_at')
    .eq('user_id', user.id)
    .not('follow_up_at', 'is', null)
    .lte('follow_up_at', new Date(Date.now() + 7 * 86400000).toISOString())
    .order('follow_up_at', { ascending: true })
    .limit(5)

  return NextResponse.json({
    totals: { total, submitted, interviews, offers, rejected, pending, avgFit: Math.round(avgFit) },
    conversion,
    events: events ?? [],
    upcomingDeadlines: deadlines ?? [],
    followUps: followUps ?? [],
  })
}
