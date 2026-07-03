import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { getGmailRedirectUri } from '@/lib/gmail/config'
import { getGoogleAuthUrl } from '@/lib/gmail/oauth'

/** Dev-only: open in browser while `pnpm dev` is running — no login required. */
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required in .env.local' },
      { status: 503 },
    )
  }

  const redirectUri = getGmailRedirectUri()
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSuffix = clientId.slice(-20)

  const state = randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('gmail_dev_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Gmail token kurulumu</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; word-break: break-all; }
    .box { background: #fff8e6; border: 1px solid #f0d080; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    a.btn { display: inline-block; margin-top: 1rem; padding: 0.6rem 1.2rem; background: #1a73e8; color: #fff; text-decoration: none; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Gmail refresh token</h1>
  <div class="box">
    <strong>Önce Google Cloud'da redirect URI ekle</strong> (OAuth client …${clientSuffix}):
    <p><code>${redirectUri}</code></p>
    <p>Credentials → OAuth 2.0 Client IDs → Web application → Authorized redirect URIs → yapıştır → <strong>Save</strong></p>
    <p><a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Credentials</a></p>
  </div>
  <p>URI'yi kaydettikten sonra:</p>
  <a class="btn" href="${getGoogleAuthUrl(state)}">Google ile devam et</a>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
