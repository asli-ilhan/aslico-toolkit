import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCultureTrackerTable } from '@/lib/supabase/errors'

const STATUSES = ['want_to_read', 'reading', 'read', 'skipped'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.title?.trim()) row.title = body.title.trim()
  if (body.author !== undefined) row.author = body.author?.trim() || null
  if (body.language) row.language = body.language
  if (body.category) row.category = body.category
  if (body.notes !== undefined) row.notes = body.notes?.trim() || null
  if (body.status && STATUSES.includes(body.status)) row.status = body.status

  const { data, error } = await supabase
    .from('culture_tracker_books')
    .update(row)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    if (isMissingCultureTrackerTable(error)) {
      return NextResponse.json({ error: 'culture_tracker_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ book: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase
    .from('culture_tracker_books')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    if (isMissingCultureTrackerTable(error)) {
      return NextResponse.json({ error: 'culture_tracker_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
