import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchGoogleCalendarEvents,
  refreshGoogleCalendarToken,
  type ExternalCalendarEvent,
} from './google'
import {
  fetchMicrosoftCalendarEvents,
  refreshMicrosoftCalendarToken,
} from './microsoft'

interface ConnectionRow {
  id: string
  provider: 'google' | 'microsoft'
  account_email: string | null
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  calendar_id: string | null
}

async function ensureAccessToken(
  supabase: SupabaseClient,
  conn: ConnectionRow,
): Promise<string> {
  const expires = conn.expires_at ? new Date(conn.expires_at).getTime() : 0
  if (expires > Date.now() + 60_000) return conn.access_token
  if (!conn.refresh_token) return conn.access_token

  const tokens =
    conn.provider === 'google' ?
      await refreshGoogleCalendarToken(conn.refresh_token)
    : await refreshMicrosoftCalendarToken(conn.refresh_token)

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  await supabase
    .from('calendar_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? conn.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id)

  return tokens.access_token
}

async function upsertExternalEvents(
  supabase: SupabaseClient,
  userId: string,
  source: 'google' | 'microsoft',
  connectionId: string,
  accountEmail: string | null,
  events: ExternalCalendarEvent[],
) {
  let imported = 0
  for (const ev of events) {
    const sourceRef = `${source}:${connectionId}:${ev.externalId}`
    const row = {
      user_id: userId,
      title: ev.title,
      description: ev.description ?? null,
      starts_at: ev.startsAt,
      ends_at: ev.endsAt ?? null,
      all_day: ev.allDay,
      source,
      source_ref: sourceRef,
      source_account: accountEmail,
      color: source === 'google' ? '#4285f4' : '#0078d4',
      updated_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('user_id', userId)
      .eq('source_ref', sourceRef)
      .maybeSingle()

    if (existing) {
      await supabase.from('calendar_events').update(row).eq('id', existing.id)
    } else {
      const { error } = await supabase.from('calendar_events').insert(row)
      if (!error) imported++
    }
  }
  return imported
}

export async function syncExternalCalendars(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ google: number; microsoft: number; errors: string[] }> {
  const timeMin = new Date()
  timeMin.setDate(timeMin.getDate() - 7)
  const timeMax = new Date()
  timeMax.setDate(timeMax.getDate() + 90)

  const timeMinIso = timeMin.toISOString()
  const timeMaxIso = timeMax.toISOString()

  const { data: connections } = await supabase
    .from('calendar_connections')
    .select('id, provider, account_email, access_token, refresh_token, expires_at, calendar_id')
    .eq('user_id', userId)

  let googleCount = 0
  let microsoftCount = 0
  const errors: string[] = []

  for (const conn of (connections ?? []) as ConnectionRow[]) {
    const label = conn.account_email ?? conn.provider
    try {
      const token = await ensureAccessToken(supabase, conn)
      const events =
        conn.provider === 'google' ?
          await fetchGoogleCalendarEvents(
            token,
            conn.calendar_id ?? 'primary',
            timeMinIso,
            timeMaxIso,
          )
        : await fetchMicrosoftCalendarEvents(token, timeMinIso, timeMaxIso)

      const n = await upsertExternalEvents(
        supabase,
        userId,
        conn.provider,
        conn.id,
        conn.account_email,
        events,
      )
      if (conn.provider === 'google') googleCount += n
      else microsoftCount += n
    } catch (err) {
      errors.push(`${label}: ${err instanceof Error ? err.message : 'sync failed'}`)
    }
  }

  return { google: googleCount, microsoft: microsoftCount, errors }
}

export async function deleteConnectionEvents(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string,
  provider: 'google' | 'microsoft',
) {
  const prefix = `${provider}:${connectionId}:`
  await supabase
    .from('calendar_events')
    .delete()
    .eq('user_id', userId)
    .eq('source', provider)
    .like('source_ref', `${prefix}%`)
}
