import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeMicrosoftCalendarCode,
  fetchMicrosoftAccountEmail,
} from '@/lib/calendar/microsoft'
import { saveCalendarConnection } from '@/lib/calendar/connections'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const returnTo = new URL('/calendar', base)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const cookieStore = await cookies()
  const savedState = cookieStore.get('microsoft_cal_oauth_state')?.value
  cookieStore.delete('microsoft_cal_oauth_state')

  if (oauthError) {
    returnTo.searchParams.set('cal_error', oauthError)
    return NextResponse.redirect(returnTo)
  }

  if (!code || !state || !savedState || state !== savedState) {
    returnTo.searchParams.set('cal_error', 'invalid_state')
    return NextResponse.redirect(returnTo)
  }

  try {
    const tokens = await exchangeMicrosoftCalendarCode(code)
    if (!tokens.refresh_token) {
      returnTo.searchParams.set('cal_error', 'no_refresh_token')
      return NextResponse.redirect(returnTo)
    }

    const email = await fetchMicrosoftAccountEmail(tokens.access_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const saved = await saveCalendarConnection(supabase, user.id, 'microsoft', {
      account_email: email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    })

    if (!saved.ok) {
      returnTo.searchParams.set('cal_error', 'db_save_failed')
      return NextResponse.redirect(returnTo)
    }

    returnTo.searchParams.set('cal_connected', 'microsoft')
    returnTo.searchParams.set('cal_email', email)
    return NextResponse.redirect(returnTo)
  } catch (err) {
    returnTo.searchParams.set(
      'cal_error',
      err instanceof Error ? err.message : 'oauth_failed',
    )
    return NextResponse.redirect(returnTo)
  }
}
