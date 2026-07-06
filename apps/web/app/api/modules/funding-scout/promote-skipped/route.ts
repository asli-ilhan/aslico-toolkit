import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { promoteFundingFromSkipInput } from '@/lib/scout/promote-funding'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const title = String(body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  try {
    const result = await promoteFundingFromSkipInput(supabase, user.id, {
      title,
      subtitle: body.subtitle ? String(body.subtitle) : undefined,
      itemUrl: body.itemUrl ? String(body.itemUrl) : undefined,
      description: body.description ? String(body.description) : undefined,
      skipReason: String(body.skipReason ?? 'Manual promote'),
      skipCategory: String(body.skipCategory ?? 'manual'),
      fitScore: typeof body.fitScore === 'number' ? body.fitScore : null,
      candidateData: body.candidateData && typeof body.candidateData === 'object' ? body.candidateData : {},
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Promote failed' }, { status: 500 })
  }
}
