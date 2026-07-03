import { NextResponse, type NextRequest } from 'next/server'
import { chatWithAssistant } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingAssistantTable } from '@/lib/supabase/errors'
import {
  fetchJobBrief,
  fetchNewsletterInterests,
  fetchTodayCalendar,
} from '@/lib/toolkit-context'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 503 })
  }

  const body = await request.json()
  const message = String(body.message ?? '').trim()
  const locale = String(body.locale ?? 'en')

  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const { data: historyRows } = await supabase
    .from('assistant_messages')
    .select('role, content')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(20)

  const history = (historyRows ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const [jobBrief, todayEvents, interests] = await Promise.all([
    fetchJobBrief(supabase, user.id),
    fetchTodayCalendar(supabase, user.id),
    fetchNewsletterInterests(supabase, user.id),
  ])

  const { data: latestIssue } = await supabase
    .from('newsletter_issues')
    .select('title')
    .eq('user_id', user.id)
    .order('issue_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  try {
    const reply = await chatWithAssistant(message, history, {
      locale,
      pendingInbox: jobBrief.pendingCount,
      deadlines: (jobBrief.deadlines ?? []).map((d) => ({
        title: `${d.company} — ${d.role}`,
        at: d.deadline_at!,
      })),
      followUps: (jobBrief.followUps ?? []).map((d) => ({
        title: `${d.company} — ${d.role}`,
        at: d.follow_up_at!,
      })),
      todayEvents: todayEvents.map((e) => ({ title: e.title, at: e.starts_at })),
      interests,
      latestNewsletterTitle: latestIssue?.title,
    })

    const inserts = [
      { user_id: user.id, role: 'user', content: message },
      { user_id: user.id, role: 'assistant', content: reply },
    ]

    const { error: saveError } = await supabase.from('assistant_messages').insert(inserts)

    if (saveError && isMissingAssistantTable(saveError)) {
      return NextResponse.json({ reply, warning: 'assistant_table_missing' })
    }

    return NextResponse.json({ reply })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chat failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
