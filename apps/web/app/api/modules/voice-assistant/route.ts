import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingAssistantTable } from '@/lib/supabase/errors'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('assistant_messages')
    .select('id, role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(40)

  if (error) {
    if (isMissingAssistantTable(error)) {
      return NextResponse.json({ messages: [], warning: 'assistant_table_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ messages: data ?? [] })
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('assistant_messages')
    .delete()
    .eq('user_id', user.id)

  if (error && isMissingAssistantTable(error)) {
    return NextResponse.json({ ok: true })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
