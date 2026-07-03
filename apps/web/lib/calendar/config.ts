export function getGoogleCalendarRedirectUri(): string {
  if (process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim()) {
    return process.env.GOOGLE_CALENDAR_REDIRECT_URI.trim()
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/auth/google-calendar/callback`
}

export function getMicrosoftCalendarRedirectUri(): string {
  if (process.env.MICROSOFT_CALENDAR_REDIRECT_URI?.trim()) {
    return process.env.MICROSOFT_CALENDAR_REDIRECT_URI.trim()
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/auth/microsoft-calendar/callback`
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function isMicrosoftCalendarConfigured(): boolean {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
}
