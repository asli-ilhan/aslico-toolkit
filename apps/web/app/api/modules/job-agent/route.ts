import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV2 } from '@/lib/supabase/errors'

/** Inbox: pending_review packs for morning approval */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('application_packs')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending_review')
    .order('fit_score', { ascending: false })
    .limit(20)

  if (error) {
    if (isMissingJobAgentV2(error)) {
      return NextResponse.json({ items: [], warning: 'job_agent_v2_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
