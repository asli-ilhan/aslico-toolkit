import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV2 } from '@/lib/supabase/errors'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('job_agent_runs')
    .select('id, started_at, finished_at, jobs_scanned, packs_created, log')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(10)

  if (error) {
    if (isMissingJobAgentV2(error)) {
      return NextResponse.json({ items: [], warning: 'job_agent_v2_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
