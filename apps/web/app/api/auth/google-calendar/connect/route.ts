import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getGoogleCalendarAuthUrl } from '@/lib/calendar/google'
import { isGoogleCalendarConfigured } from '@/lib/calendar/config'

function returnUrl(request: NextRequest, error?: string): URL {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const url = new URL('/calendar', base)
  if (error) url.searchParams.set('cal_error', error)
  return url
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(returnUrl(request, 'google_not_configured'))
  }

  const state = randomBytes(24).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('google_cal_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return NextResponse.redirect(getGoogleCalendarAuthUrl(state))
}
