import { getMicrosoftCalendarRedirectUri } from './config'
import type { ExternalCalendarEvent } from './google'

const SCOPES = ['offline_access', 'Calendars.Read', 'User.Read']

export interface MicrosoftTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
}

function tenantId(): string {
  return process.env.MICROSOFT_TENANT_ID?.trim() || 'common'
}

export function getMicrosoftCalendarAuthUrl(state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  if (!clientId) throw new Error('MICROSOFT_CLIENT_ID is not set')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getMicrosoftCalendarRedirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    response_mode: 'query',
    prompt: 'select_account',
    state,
  })

  return `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/authorize?${params.toString()}`
}

export async function exchangeMicrosoftCalendarCode(code: string): Promise<MicrosoftTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Microsoft OAuth not configured')

  const res = await fetch(`https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getMicrosoftCalendarRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  const data = (await res.json()) as MicrosoftTokens & { error?: string; error_description?: string }
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? 'Token exchange failed')
  return data
}

export async function refreshMicrosoftCalendarToken(refreshToken: string): Promise<MicrosoftTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Microsoft OAuth not configured')

  const res = await fetch(`https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = (await res.json()) as MicrosoftTokens & { error?: string; error_description?: string }
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? 'Token refresh failed')
  return data
}

export async function fetchMicrosoftAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json()) as { mail?: string; userPrincipalName?: string }
  if (!res.ok) throw new Error('Could not read Microsoft account')
  return data.mail ?? data.userPrincipalName ?? 'Microsoft account'
}

export async function fetchMicrosoftCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<ExternalCalendarEvent[]> {
  const params = new URLSearchParams({
    startDateTime: timeMin,
    endDateTime: timeMax,
    $top: '250',
    $orderby: 'start/dateTime',
  })

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendar/calendarView?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' } },
  )

  const data = (await res.json()) as {
    value?: Array<{
      id: string
      subject?: string
      bodyPreview?: string
      isAllDay?: boolean
      start?: { dateTime: string; timeZone: string }
      end?: { dateTime: string; timeZone: string }
    }>
    error?: { message?: string }
  }

  if (!res.ok) throw new Error(data.error?.message ?? 'Microsoft Calendar fetch failed')

  return (data.value ?? []).map((item) => ({
    externalId: item.id,
    title: item.subject ?? 'Untitled',
    description: item.bodyPreview,
    startsAt: item.start?.dateTime ? `${item.start.dateTime}Z` : new Date().toISOString(),
    endsAt: item.end?.dateTime ? `${item.end.dateTime}Z` : undefined,
    allDay: Boolean(item.isAllDay),
  }))
}
