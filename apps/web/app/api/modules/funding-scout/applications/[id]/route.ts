import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingFundingScoutTable } from '@/lib/supabase/errors'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('funding_applications')
    .update({
      ...(body.motivation_letter !== undefined ? { motivation_letter: body.motivation_letter } : {}),
      ...(body.research_summary !== undefined ? { research_summary: body.research_summary } : {}),
      ...(body.project_outline !== undefined ? { project_outline: body.project_outline } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      updated_at: new Date().toISOString(),
    })
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

  return NextResponse.json({ item: data })
}
