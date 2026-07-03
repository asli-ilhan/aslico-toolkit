import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV4 } from '@/lib/supabase/errors'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('outreach_campaigns')
    .select(
      `
      id,
      pack_id,
      status,
      subject,
      body,
      error,
      created_at,
      updated_at,
      sent_at,
      application_packs ( company, role )
    `,
    )
    .eq('user_id', user.id)
    .in('status', ['discovering', 'draft_ready', 'failed', 'sending'])
    .order('updated_at', { ascending: false })

  if (error) {
    if (isMissingJobAgentV4(error)) {
      return NextResponse.json({ items: [], warning: 'job_agent_v4_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
