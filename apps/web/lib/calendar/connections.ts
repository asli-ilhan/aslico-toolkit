import type { SupabaseClient } from '@supabase/supabase-js'

export async function saveCalendarConnection(
  supabase: SupabaseClient,
  userId: string,
  provider: 'google' | 'microsoft',
  data: {
    account_email: string
    access_token: string
    refresh_token: string
    expires_at: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from('calendar_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('account_email', data.account_email)
    .maybeSingle()

  const row = {
    user_id: userId,
    provider,
    account_email: data.account_email,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    calendar_id: 'primary',
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabase.from('calendar_connections').update(row).eq('id', existing.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  const { error } = await supabase.from('calendar_connections').insert(row)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
