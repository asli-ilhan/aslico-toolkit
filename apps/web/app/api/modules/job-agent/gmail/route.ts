import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV4 } from '@/lib/supabase/errors'
import {
  getGmailRedirectUri,
  getGmailSenderEmail,
  isGmailEnvConfigured,
} from '@/lib/gmail/config'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const envConnected = isGmailEnvConfigured()
  const envEmail = getGmailSenderEmail()

  const { data, error } = await supabase
    .from('gmail_connections')
    .select('email, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    if (isMissingJobAgentV4(error)) {
      return NextResponse.json({
        connected: envConnected,
        mode: envConnected ? 'env' : null,
        email: envEmail,
        warning: 'job_agent_v4_missing',
        redirectUri: getGmailRedirectUri(),
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const oauthConnected = Boolean(data)
  const connected = envConnected || oauthConnected

  return NextResponse.json({
    connected,
    mode: envConnected ? 'env' : oauthConnected ? 'oauth' : null,
    email: envConnected ? envEmail : data?.email ?? null,
    updatedAt: data?.updated_at ?? null,
    oauthConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
    envConfigured: envConnected,
    redirectUri: getGmailRedirectUri(),
  })
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await supabase.from('gmail_connections').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
