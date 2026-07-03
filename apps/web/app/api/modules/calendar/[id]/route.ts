import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCalendarTable } from '@/lib/supabase/errors'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title != null) updates.title = String(body.title)
  if (body.description != null) updates.description = body.description ? String(body.description) : null
  if (body.starts_at != null) updates.starts_at = String(body.starts_at)
  if (body.ends_at != null) updates.ends_at = body.ends_at ? String(body.ends_at) : null
  if (body.all_day != null) updates.all_day = Boolean(body.all_day)

  const { data, error } = await supabase
    .from('calendar_events')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    if (isMissingCalendarTable(error)) {
      return NextResponse.json({ warning: 'calendar_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
