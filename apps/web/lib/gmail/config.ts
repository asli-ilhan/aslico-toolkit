/** Canonical OAuth redirect — must match Google Cloud Console exactly. */
export function getGmailRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI?.trim()) {
    return process.env.GOOGLE_REDIRECT_URI.trim()
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/auth/gmail/callback`
}

export function getGmailSenderEmail(): string | null {
  return (
    process.env.GMAIL_SENDER_EMAIL?.trim() ||
    process.env.ALLOWED_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL?.trim() ||
    null
  )
}

export function isGmailEnvConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN?.trim() &&
      getGmailSenderEmail(),
  )
}
