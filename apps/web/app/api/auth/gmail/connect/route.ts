import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getGoogleAuthUrl } from '@/lib/gmail/oauth'
import { randomBytes } from 'crypto'

function preferencesUrl(request: NextRequest, gmailError?: string): URL {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const url = new URL('/job-agent', base)
  url.searchParams.set('tab', 'preferences')
  if (gmailError) url.searchParams.set('gmail_error', gmailError)
  return url
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(preferencesUrl(request, 'not_configured'))
  }

  const state = randomBytes(24).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const url = getGoogleAuthUrl(state)
  return NextResponse.redirect(url)
}
