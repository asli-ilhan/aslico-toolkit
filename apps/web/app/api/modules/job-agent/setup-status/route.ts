import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isGmailEnvConfigured } from '@/lib/gmail/config'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = {
    sqlV2: false,
    sqlV3: false,
    sqlV4: false,
    profile: false,
    gmail: false,
    gmailMode: null as 'env' | 'oauth' | null,
    inboxCount: 0,
    isProduction: process.env.NODE_ENV === 'production',
    isDev: process.env.NODE_ENV === 'development',
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  }

  const { error: packProbe } = await supabase.from('application_packs').select('id').limit(1)
  status.sqlV2 = !packProbe

  const { error: eventsProbe } = await supabase.from('application_events').select('id').limit(1)
  status.sqlV3 = !eventsProbe

  const { error: outreachProbe } = await supabase.from('outreach_campaigns').select('id').limit(1)
  status.sqlV4 = !outreachProbe

  const { data: profileRow } = await supabase
    .from('candidate_profiles')
    .select('master_profile')
    .eq('user_id', user.id)
    .maybeSingle()

  const mp = profileRow?.master_profile as { summary?: string; evidence?: unknown[] } | null
  status.profile = Boolean(mp?.summary || mp?.evidence?.length)

  if (isGmailEnvConfigured()) {
    status.gmail = true
    status.gmailMode = 'env'
  } else {
    const { data: gmailRow } = await supabase
      .from('gmail_connections')
      .select('email')
      .eq('user_id', user.id)
      .maybeSingle()
    status.gmail = Boolean(gmailRow)
    if (gmailRow) status.gmailMode = 'oauth'
  }

  const { count } = await supabase
    .from('application_packs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending_review')

  status.inboxCount = count ?? 0

  return NextResponse.json(status)
}
