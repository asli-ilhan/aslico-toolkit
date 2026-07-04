import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCalendarTable, isMissingFundingScoutTable } from '@/lib/supabase/errors'
import { upsertFundingDeadlineEvent } from '@/lib/funding-scout/calendar-sync'

/** Import Funding Scout deadlines as calendar events */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: apps, error: appError } = await supabase
    .from('funding_applications')
    .select('id, funder, title, deadline, status')
    .eq('user_id', user.id)
    .not('deadline', 'is', null)
    .gte('deadline', new Date().toISOString().slice(0, 10))
    .in('status', ['pending_review', 'approved', 'submitted', 'awarded'])

  if (appError) {
    if (isMissingFundingScoutTable(appError)) {
      return NextResponse.json({ warning: 'funding_scout_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: appError.message }, { status: 500 })
  }

  let imported = 0
  for (const app of apps ?? []) {
    if (!app.deadline) continue
    try {
      await upsertFundingDeadlineEvent(supabase, user.id, app.id, app.funder, app.title, app.deadline)
      imported++
    } catch (err) {
      if (isMissingCalendarTable(err as { code?: string; message?: string })) {
        return NextResponse.json({ warning: 'calendar_table_missing' }, { status: 503 })
      }
    }
  }

  return NextResponse.json({ imported })
}
