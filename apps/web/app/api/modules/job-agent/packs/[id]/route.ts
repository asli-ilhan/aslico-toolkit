import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { defaultFollowUpDate } from '@/lib/job-agent/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.status) {
    updates.status = String(body.status)
    if (['approved', 'skipped', 'rejected'].includes(body.status)) {
      updates.reviewed_at = new Date().toISOString()
    }
    if (body.status === 'submitted') {
      updates.submitted_at = new Date().toISOString()
      updates.funnel_stage = 'applied'
      updates.follow_up_at = defaultFollowUpDate()
      await supabase.from('application_events').insert({
        user_id: user.id,
        pack_id: id,
        event_type: 'submitted',
        notes: body.notes ?? null,
      })
      void import('@/lib/job-agent/outreach')
        .then(({ runOutreachPipeline }) => runOutreachPipeline(supabase, user.id, id))
        .catch((err) => console.error('[outreach]', err))
    }
    if (body.status === 'approved') {
      await supabase.from('application_events').insert({
        user_id: user.id,
        pack_id: id,
        event_type: 'approved',
      })
    }
  }

  if (body.funnel_stage) {
    updates.funnel_stage = String(body.funnel_stage)
    await supabase.from('application_events').insert({
      user_id: user.id,
      pack_id: id,
      event_type: String(body.funnel_stage),
      notes: body.notes ?? null,
    })
    if (body.funnel_stage === 'interview') {
      const d = new Date()
      d.setDate(d.getDate() + 3)
      updates.follow_up_at = d.toISOString()
    }
  }

  if (body.cover_letter !== undefined) updates.cover_letter = String(body.cover_letter)
  if (body.tailored_cv !== undefined) updates.tailored_cv = String(body.tailored_cv)
  if (body.notes !== undefined) updates.notes = String(body.notes)
  if (body.email_draft !== undefined) updates.email_draft = String(body.email_draft)
  if (body.deadline_at !== undefined) updates.deadline_at = body.deadline_at || null
  if (body.follow_up_at !== undefined) updates.follow_up_at = body.follow_up_at || null

  const { data, error } = await supabase
    .from('application_packs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('application_packs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
