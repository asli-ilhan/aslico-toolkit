import { getGoogleCalendarRedirectUri } from './config'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

export interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
}

export function getGoogleCalendarAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleCalendarRedirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'select_account consent',
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeGoogleCalendarCode(code: string): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Google OAuth not configured')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleCalendarRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  const data = (await res.json()) as GoogleTokens & { error?: string; error_description?: string }
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? 'Token exchange failed')
  return data
}

export async function refreshGoogleCalendarToken(refreshToken: string): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Google OAuth not configured')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = (await res.json()) as GoogleTokens & { error?: string; error_description?: string }
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? 'Token refresh failed')
  return data
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json()) as { email?: string }
  if (!res.ok || !data.email) throw new Error('Could not read Google email')
  return data.email
}

export interface ExternalCalendarEvent {
  externalId: string
  title: string
  description?: string
  startsAt: string
  endsAt?: string
  allDay: boolean
}

export async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<ExternalCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  const data = (await res.json()) as {
    items?: Array<{
      id: string
      summary?: string
      description?: string
      start?: { dateTime?: string; date?: string }
      end?: { dateTime?: string; date?: string }
    }>
    error?: { message?: string }
  }

  if (!res.ok) throw new Error(data.error?.message ?? 'Google Calendar fetch failed')

  return (data.items ?? []).map((item) => {
    const allDay = Boolean(item.start?.date && !item.start?.dateTime)
    const startsAt =
      item.start?.dateTime ??
      (item.start?.date ? `${item.start.date}T00:00:00.000Z` : new Date().toISOString())
    const endsAt =
      item.end?.dateTime ??
      (item.end?.date ? `${item.end.date}T00:00:00.000Z` : undefined)

    return {
      externalId: item.id,
      title: item.summary ?? 'Untitled',
      description: item.description,
      startsAt,
      endsAt,
      allDay,
    }
  })
}
