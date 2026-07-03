import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCalendarV2 } from '@/lib/supabase/errors'
import { syncExternalCalendars, deleteConnectionEvents } from '@/lib/calendar/sync'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await syncExternalCalendars(supabase, user.id)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    if (message.includes('calendar_connections')) {
      return NextResponse.json({ warning: 'calendar_v2_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('id, provider, account_email, updated_at')
    .eq('user_id', user.id)
    .order('provider')
    .order('account_email')

  if (error) {
    if (isMissingCalendarV2(error)) {
      return NextResponse.json({ connections: [], warning: 'calendar_v2_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ connections: data ?? [] })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { data: conn } = await supabase
    .from('calendar_connections')
    .select('id, provider')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await deleteConnectionEvents(
    supabase,
    user.id,
    conn.id,
    conn.provider as 'google' | 'microsoft',
  )

  await supabase.from('calendar_connections').delete().eq('id', id).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
