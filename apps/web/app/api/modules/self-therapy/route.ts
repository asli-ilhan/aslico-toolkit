import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingSelfTherapyTable } from '@/lib/supabase/errors'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('self_therapy_sessions')
    .select(
      'id, title, topic, locale, induction, deepening, suggestions, full_script, audio_path, duration_seconds, status, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) {
    if (isMissingSelfTherapyTable(error)) {
      return NextResponse.json({ items: [], warning: 'self_therapy_table_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: row } = await supabase
    .from('self_therapy_sessions')
    .select('audio_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (row?.audio_path) {
    await supabase.storage.from('self-therapy-audio').remove([row.audio_path])
  }

  const { error } = await supabase
    .from('self_therapy_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
