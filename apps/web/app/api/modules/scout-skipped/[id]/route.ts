import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingScoutSkippedTable } from '@/lib/supabase/errors'
import { dismissScoutSkippedItem, markScoutSkippedPromoted } from '@/lib/scout/skipped'
import { promoteFundingSkippedToPack } from '@/lib/scout/promote-funding'
import { promoteJobSkippedToPack } from '@/lib/scout/promote-job'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: item, error: fetchError } = await supabase
    .from('scout_skipped_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    if (isMissingScoutSkippedTable(fetchError)) {
      return NextResponse.json({ error: 'scout_skipped_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (item.promoted_at) return NextResponse.json({ error: 'Already promoted' }, { status: 400 })

  try {
    if (item.module_id === 'funding-scout') {
      const result = await promoteFundingSkippedToPack(supabase, user.id, item)
      await markScoutSkippedPromoted(supabase, user.id, id)
      return NextResponse.json({ ok: true, moduleId: item.module_id, ...result })
    }
    if (item.module_id === 'job-agent') {
      const result = await promoteJobSkippedToPack(supabase, user.id, item)
      await markScoutSkippedPromoted(supabase, user.id, id)
      return NextResponse.json({ ok: true, moduleId: item.module_id, ...result })
    }
    return NextResponse.json({ error: 'Unknown module' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Pack failed' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await dismissScoutSkippedItem(supabase, user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isMissingScoutSkippedTable(error as { code?: string; message?: string })) {
      return NextResponse.json({ error: 'scout_skipped_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}
