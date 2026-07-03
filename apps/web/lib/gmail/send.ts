import type { SupabaseClient } from '@supabase/supabase-js'
import { getGmailSenderEmail, isGmailEnvConfigured } from './config'
import { refreshAccessToken } from './oauth'

export interface GmailConnectionRow {
  user_id: string
  email: string
  access_token: string
  refresh_token: string
  expires_at: string
}

let envTokenCache: { accessToken: string; expiresAt: number } | null = null

async function getEnvGmailAccess(): Promise<{ accessToken: string; email: string } | null> {
  if (!isGmailEnvConfigured()) return null

  const email = getGmailSenderEmail()!
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN!.trim()

  if (envTokenCache && Date.now() < envTokenCache.expiresAt - 60_000) {
    return { accessToken: envTokenCache.accessToken, email }
  }

  const tokens = await refreshAccessToken(refreshToken)
  envTokenCache = {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }
  return { accessToken: tokens.access_token, email }
}

export async function getGmailConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<GmailConnectionRow | null> {
  const { data, error } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as GmailConnectionRow | null
}

/** Backend Gmail: env refresh token first, then OAuth row in DB. */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ accessToken: string; email: string; mode: 'env' | 'oauth' }> {
  const envAccess = await getEnvGmailAccess()
  if (envAccess) {
    return { ...envAccess, mode: 'env' }
  }

  const conn = await getGmailConnection(supabase, userId)
  if (!conn) throw new Error('Gmail not connected')

  const expiresAt = new Date(conn.expires_at).getTime()
  const bufferMs = 60_000

  if (Date.now() < expiresAt - bufferMs) {
    return { accessToken: conn.access_token, email: conn.email, mode: 'oauth' }
  }

  const tokens = await refreshAccessToken(conn.refresh_token)
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error } = await supabase
    .from('gmail_connections')
    .update({
      access_token: tokens.access_token,
      expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw error
  return { accessToken: tokens.access_token, email: conn.email, mode: 'oauth' }
}

export async function sendGmailMessage(
  accessToken: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string,
): Promise<void> {
  const message = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n')

  const raw = Buffer.from(message, 'utf-8').toString('base64url')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `Gmail send failed (${res.status})`)
  }
}

function encodeSubject(subject: string): string {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject
  return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`
}
