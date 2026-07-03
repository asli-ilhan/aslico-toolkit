import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getAllowedEmail } from '@/lib/auth/allowlist'
import { createAdminClient } from '@/lib/supabase/admin'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Dev-only: signs in allowed user without sending email.
 * Uses admin generateLink + server-side verifyOtp + session cookies.
 */
export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  const setupEnabled = process.env.ALLOW_SETUP === 'true'

  if (!isDev && !setupEnabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error: 'SUPABASE_SERVICE_ROLE_KEY eksik',
        hint: 'Supabase Dashboard → Settings → API → service_role key',
      },
      { status: 500 },
    )
  }

  const email = getAllowedEmail()
  if (!email) {
    return NextResponse.json({ error: 'ALLOWED_EMAIL tanımlı değil' }, { status: 500 })
  }

  const redirectPath = '/account/passkeys'
  let response = NextResponse.redirect(new URL(redirectPath, request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.redirect(new URL(redirectPath, request.url))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
      auth: {
        experimental: { passkey: true },
      },
    },
  )

  try {
    const admin = createAdminClient()

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    const tokenHash = linkData?.properties?.hashed_token
    if (linkError || !tokenHash) {
      return NextResponse.json(
        { error: linkError?.message ?? 'Token oluşturulamadı' },
        { status: 500 },
      )
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    })

    if (verifyError) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(verifyError.message)}`, request.url),
      )
    }

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Setup failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
