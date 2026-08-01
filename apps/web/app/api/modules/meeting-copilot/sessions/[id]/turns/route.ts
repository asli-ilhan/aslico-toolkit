import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingMeetingCopilotTable } from '@/lib/supabase/errors'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: session, error: sessionError } = await supabase
    .from('meeting_sessions')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (sessionError) {
    if (isMissingMeetingCopilotTable(sessionError)) {
      return NextResponse.json({ items: [], warning: 'meeting_copilot_table_missing' })
    }
    return NextResponse.json({ error: sessionError.message }, { status: 500 })
  }
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('meeting_turns')
    .select('id, question_text, answer_json, detected_language, latency_ms, created_at')
    .eq('session_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
