import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Dashboard morning brief: inbox count, deadlines, follow-ups */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { count: pendingCount } = await supabase
    .from('application_packs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending_review')

  const { data: deadlines } = await supabase
    .from('application_packs')
    .select('id, company, role, deadline_at')
    .eq('user_id', user.id)
    .not('deadline_at', 'is', null)
    .gte('deadline_at', new Date().toISOString())
    .order('deadline_at', { ascending: true })
    .limit(5)

  const { data: followUps } = await supabase
    .from('application_packs')
    .select('id, company, role, follow_up_at')
    .eq('user_id', user.id)
    .not('follow_up_at', 'is', null)
    .lte('follow_up_at', new Date(Date.now() + 14 * 86400000).toISOString())
    .gte('follow_up_at', new Date(Date.now() - 86400000).toISOString())
    .order('follow_up_at', { ascending: true })
    .limit(5)

  return NextResponse.json({
    pendingCount: pendingCount ?? 0,
    deadlines: deadlines ?? [],
    followUps: followUps ?? [],
  })
}
