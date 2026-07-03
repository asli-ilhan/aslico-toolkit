import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV4 } from '@/lib/supabase/errors'
import { runOutreachPipeline, sendApprovedOutreach } from '@/lib/job-agent/outreach'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: packId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: campaign, error } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .eq('pack_id', packId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    if (isMissingJobAgentV4(error)) {
      return NextResponse.json({ campaign: null, warning: 'job_agent_v4_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!campaign) {
    return NextResponse.json({ campaign: null, recipients: [] })
  }

  const { data: recipients } = await supabase
    .from('outreach_recipients')
    .select('*')
    .eq('campaign_id', campaign.id)
    .order('relevance_score', { ascending: false })

  return NextResponse.json({ campaign, recipients: recipients ?? [] })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: packId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.subject !== undefined) updates.subject = String(body.subject)
  if (body.body !== undefined) updates.body = String(body.body)

  const { data: campaign, error } = await supabase
    .from('outreach_campaigns')
    .update(updates)
    .eq('pack_id', packId)
    .eq('user_id', user.id)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, campaignId: campaign.id })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: packId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const action = body.action as string | undefined

  if (action === 'discover') {
    try {
      await runOutreachPipeline(supabase, user.id, packId)
      return NextResponse.json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Discovery failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  if (action === 'send') {
    const { data: campaign } = await supabase
      .from('outreach_campaigns')
      .select('subject, body, status')
      .eq('pack_id', packId)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'No outreach campaign' }, { status: 404 })
    }

    const subject = String(body.subject ?? campaign.subject ?? '')
    const emailBody = String(body.body ?? campaign.body ?? '')

    if (!subject.trim() || !emailBody.trim()) {
      return NextResponse.json({ error: 'Subject and body required' }, { status: 400 })
    }

    try {
      const result = await sendApprovedOutreach(supabase, user.id, packId, subject, emailBody)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
