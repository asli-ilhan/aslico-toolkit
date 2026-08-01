import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingMeetingCopilotTable } from '@/lib/supabase/errors'

const LANG = new Set(['auto', 'tr', 'en'])

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('meeting_sessions')
    .select(
      'id, counterparty, focus, language_mode, tag_filter, status, started_at, ended_at, created_at',
    )
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(40)

  if (error) {
    if (isMissingMeetingCopilotTable(error)) {
      return NextResponse.json({ items: [], warning: 'meeting_copilot_table_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const counterparty = String(body.counterparty ?? '').trim()
  const focus = String(body.focus ?? '').trim()
  const languageMode = String(body.languageMode ?? 'auto')
  const tagFilter = Array.isArray(body.tagFilter)
    ? body.tagFilter.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 20)
    : String(body.tagFilter ?? '')
        .split(/[,;\n]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20)

  if (!LANG.has(languageMode)) {
    return NextResponse.json({ error: 'invalid languageMode' }, { status: 400 })
  }

  // End any other active sessions for this user
  await supabase
    .from('meeting_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('status', 'active')

  const { data, error } = await supabase
    .from('meeting_sessions')
    .insert({
      user_id: user.id,
      counterparty,
      focus,
      language_mode: languageMode,
      tag_filter: tagFilter,
      status: 'active',
    })
    .select(
      'id, counterparty, focus, language_mode, tag_filter, status, started_at, ended_at, created_at',
    )
    .single()

  if (error) {
    if (isMissingMeetingCopilotTable(error)) {
      return NextResponse.json({ error: 'meeting_copilot_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('meeting_sessions')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select(
      'id, counterparty, focus, language_mode, tag_filter, status, started_at, ended_at, created_at',
    )
    .single()

  if (error) {
    if (isMissingMeetingCopilotTable(error)) {
      return NextResponse.json({ error: 'meeting_copilot_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}
