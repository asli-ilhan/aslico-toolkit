import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCalendarTable } from '@/lib/supabase/errors'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  const start = from ?? new Date().toISOString()
  const end =
    to ?? new Date(Date.now() + 30 * 86400000).toISOString()

  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, description, starts_at, ends_at, all_day, source, source_ref, source_account, color')
    .eq('user_id', user.id)
    .gte('starts_at', start)
    .lte('starts_at', end)
    .order('starts_at', { ascending: true })

  if (error) {
    if (isMissingCalendarTable(error)) {
      return NextResponse.json({ events: [], warning: 'calendar_table_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const title = String(body.title ?? '').trim()
  const startsAt = String(body.starts_at ?? '').trim()

  if (!title || !startsAt) {
    return NextResponse.json({ error: 'title and starts_at required' }, { status: 400 })
  }

  const payload = {
    user_id: user.id,
    title,
    description: body.description ? String(body.description) : null,
    starts_at: startsAt,
    ends_at: body.ends_at ? String(body.ends_at) : null,
    all_day: Boolean(body.all_day),
    source: 'manual',
    color: body.color ? String(body.color) : null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert(payload)
    .select('id, title, description, starts_at, ends_at, all_day, source, source_ref, color')
    .single()

  if (error) {
    if (isMissingCalendarTable(error)) {
      return NextResponse.json({ warning: 'calendar_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ event: data })
}
