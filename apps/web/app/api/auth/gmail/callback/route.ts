import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, fetchGoogleEmail } from '@/lib/gmail/oauth'
import { getGmailRedirectUri } from '@/lib/gmail/config'

function devTokenHtml(opts: {
  ok: boolean
  title: string
  body: string
  refreshToken?: string
  email?: string
}): string {
  const tokenBlock =
    opts.refreshToken ?
      `<pre style="background:#f4f4f4;padding:1rem;border-radius:8px;overflow:auto">GMAIL_REFRESH_TOKEN=${opts.refreshToken}
GMAIL_SENDER_EMAIL=${opts.email ?? 'a.asliilhan@gmail.com'}</pre>
<p>Dev sunucu terminalinde de yazdırıldı. <code>.env.local</code> dosyasına yapıştır ve sunucuyu yeniden başlat.</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8" /><title>${opts.title}</title></head>
<body style="font-family:system-ui;max-width:640px;margin:2rem auto;padding:0 1rem">
<h1>${opts.title}</h1>
<p>${opts.body}</p>
${tokenBlock}
</body></html>`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  const cookieStore = await cookies()
  const devState = cookieStore.get('gmail_dev_oauth_state')?.value
  const isDevFlow =
    process.env.NODE_ENV === 'development' &&
    devState &&
    state &&
    state === devState

  if (oauthError) {
    if (isDevFlow) {
      cookieStore.delete('gmail_dev_oauth_state')
      const hint =
        oauthError === 'redirect_uri_mismatch' ?
          ` Google Cloud'a tam olarak şunu ekle: <code>${getGmailRedirectUri()}</code>`
        : ''
      return new NextResponse(
        devTokenHtml({
          ok: false,
          title: 'OAuth hatası',
          body: `${oauthError}${hint}`,
        }),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )
    }
  }

  if (isDevFlow) {
    cookieStore.delete('gmail_dev_oauth_state')

    if (!code) {
      return new NextResponse(
        devTokenHtml({ ok: false, title: 'Kod yok', body: 'Google authorization code gelmedi.' }),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )
    }

    try {
      const tokens = await exchangeCodeForTokens(code)
      const email = await fetchGoogleEmail(tokens.access_token)

      if (!tokens.refresh_token) {
        return new NextResponse(
          devTokenHtml({
            ok: false,
            title: 'Refresh token yok',
            body:
              'Google yalnızca access_token döndü. <a href="https://myaccount.google.com/permissions">Hesap izinleri</a> sayfasından uygulama erişimini kaldır, sonra tekrar dene.',
          }),
          { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
      }

      console.log(
        '\n[gmail dev] apps/web/.env.local dosyasına ekle:\n' +
          `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n` +
          `GMAIL_SENDER_EMAIL=${email}\n`,
      )

      return new NextResponse(
        devTokenHtml({
          ok: true,
          title: 'Tamam',
          body: 'Refresh token alındı.',
          refreshToken: tokens.refresh_token,
          email,
        }),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'oauth_failed'
      return new NextResponse(
        devTokenHtml({ ok: false, title: 'Hata', body: message }),
        { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const savedState = cookieStore.get('gmail_oauth_state')?.value
  cookieStore.delete('gmail_oauth_state')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const returnTo = new URL('/job-agent', appUrl)
  returnTo.searchParams.set('tab', 'preferences')
  returnTo.searchParams.set('gmail', '1')

  if (oauthError) {
    returnTo.searchParams.set('gmail_error', oauthError)
    return NextResponse.redirect(returnTo)
  }

  if (!code || !state || !savedState || state !== savedState) {
    returnTo.searchParams.set('gmail_error', 'invalid_state')
    return NextResponse.redirect(returnTo)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      returnTo.searchParams.set('gmail_error', 'no_refresh_token')
      return NextResponse.redirect(returnTo)
    }

    const email = await fetchGoogleEmail(tokens.access_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const { error } = await supabase.from('gmail_connections').upsert({
      user_id: user.id,
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scopes: 'gmail.send',
      updated_at: new Date().toISOString(),
    })

    if (error) {
      returnTo.searchParams.set('gmail_error', 'db_save_failed')
      return NextResponse.redirect(returnTo)
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(
        '\n[gmail] Optional — backend-only mode. Add to apps/web/.env.local:\n' +
          `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n` +
          `GMAIL_SENDER_EMAIL=${email}\n` +
          `GOOGLE_REDIRECT_URI=${getGmailRedirectUri()}\n`,
      )
    }

    returnTo.searchParams.set('gmail_connected', '1')
    return NextResponse.redirect(returnTo)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed'
    returnTo.searchParams.set('gmail_error', message)
    return NextResponse.redirect(returnTo)
  }
}
