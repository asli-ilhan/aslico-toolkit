import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingTravelScoutTable } from '@/lib/supabase/errors'
import { fetchTravelSettings } from '@/lib/travel-scout/scout'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [settingsRes, reportsRes, plansRes] = await Promise.all([
    supabase.from('travel_scout_settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('travel_scout_reports')
      .select('id, destination, report_key, title, sections, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('travel_scout_plans')
      .select('id, destination, start_date, end_date, notes, created_at')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true })
      .limit(10),
  ])

  const err = settingsRes.error ?? reportsRes.error ?? plansRes.error
  if (err && isMissingTravelScoutTable(err)) {
    return NextResponse.json({ warning: 'travel_scout_table_missing' })
  }

  const settings = await fetchTravelSettings(supabase, user.id)

  return NextResponse.json({
    settings,
    reports: reportsRes.data ?? [],
    plans: plansRes.data ?? [],
  })
}
