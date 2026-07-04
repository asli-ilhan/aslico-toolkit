import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingFundingScoutTable } from '@/lib/supabase/errors'
import { upsertFundingDeadlineEvent, removeFundingDeadlineEvent } from '@/lib/funding-scout/calendar-sync'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.motivation_letter !== undefined) updates.motivation_letter = body.motivation_letter
  if (body.research_summary !== undefined) updates.research_summary = body.research_summary
  if (body.project_outline !== undefined) updates.project_outline = body.project_outline
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.status !== undefined) updates.status = body.status
  if (body.deadline !== undefined) {
    updates.deadline = body.deadline && /^\d{4}-\d{2}-\d{2}$/.test(String(body.deadline)) ?
      String(body.deadline)
    : null
  }

  const { data, error } = await supabase
    .from('funding_applications')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    if (isMissingFundingScoutTable(error)) {
      return NextResponse.json({ error: 'funding_scout_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.deadline !== undefined) {
    if (data.deadline) {
      await upsertFundingDeadlineEvent(supabase, user.id, id, data.funder, data.title, data.deadline)
    } else {
      await removeFundingDeadlineEvent(supabase, user.id, id)
    }
  }

  if (body.status === 'skipped' || body.status === 'rejected') {
    await removeFundingDeadlineEvent(supabase, user.id, id)
  }

  return NextResponse.json({ item: data })
}
