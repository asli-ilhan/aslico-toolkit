import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCalendarV2 } from '@/lib/supabase/errors'

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
  if (body.done != null) updates.done = Boolean(body.done)
  if (body.title != null) updates.title = String(body.title).trim()

  const { data, error } = await supabase
    .from('calendar_todos')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, due_date, title, done, created_at')
    .single()

  if (error) {
    if (isMissingCalendarV2(error)) {
      return NextResponse.json({ warning: 'calendar_v2_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ todo: data })
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
    .from('calendar_todos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error && isMissingCalendarV2(error)) {
    return NextResponse.json({ warning: 'calendar_v2_missing' }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}
