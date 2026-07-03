import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCalendarTable } from '@/lib/supabase/errors'

/** Import Job Agent deadlines and follow-ups as calendar events */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: packs, error: packError } = await supabase
    .from('application_packs')
    .select('id, company, role, deadline_at, follow_up_at')
    .eq('user_id', user.id)

  if (packError) {
    return NextResponse.json({ error: packError.message }, { status: 500 })
  }

  const toInsert: Array<{
    user_id: string
    title: string
    starts_at: string
    all_day: boolean
    source: string
    source_ref: string
    color: string
  }> = []

  for (const p of packs ?? []) {
    if (p.deadline_at) {
      toInsert.push({
        user_id: user.id,
        title: `Deadline: ${p.company} — ${p.role}`,
        starts_at: p.deadline_at,
        all_day: true,
        source: 'job-agent',
        source_ref: `deadline:${p.id}`,
        color: '#f97316',
      })
    }
    if (p.follow_up_at) {
      toInsert.push({
        user_id: user.id,
        title: `Follow-up: ${p.company} — ${p.role}`,
        starts_at: p.follow_up_at,
        all_day: true,
        source: 'job-agent',
        source_ref: `followup:${p.id}`,
        color: '#fb923c',
      })
    }
  }

  if (!toInsert.length) {
    return NextResponse.json({ imported: 0 })
  }

  const { data: existing } = await supabase
    .from('calendar_events')
    .select('source_ref')
    .eq('user_id', user.id)
    .eq('source', 'job-agent')

  const existingRefs = new Set((existing ?? []).map((e) => e.source_ref))
  const fresh = toInsert.filter((e) => !existingRefs.has(e.source_ref))

  if (!fresh.length) {
    return NextResponse.json({ imported: 0, skipped: toInsert.length })
  }

  const { error } = await supabase.from('calendar_events').insert(fresh)

  if (error) {
    if (isMissingCalendarTable(error)) {
      return NextResponse.json({ warning: 'calendar_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ imported: fresh.length })
}
