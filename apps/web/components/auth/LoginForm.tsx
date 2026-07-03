'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BackgroundCanvas } from '@/components/canvas/BackgroundCanvas'
import { GlassPanel, Button } from '@aslico/ui'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/components/shell/LocaleProvider'
import { isEmailAllowed, mapAuthError } from '@/lib/auth/allowlist'
import { isPasskeyAuthEnabled } from '@/lib/auth/config'
import { PasskeyLoginSection } from '@/components/auth/PasskeyLoginSection'

const SUPABASE_GOOGLE_PROVIDER_URL =
  'https://supabase.com/dashboard/project/uhepdwjqkyjdiaugtjln/auth/providers?provider=Google'

function resolveLoginError(message: string, t: ReturnType<typeof useLocale>['t']): string {
  const mapped = mapAuthError(message)
  if (mapped === 'email_rate_limit') return t.login.errors.emailRateLimit
  if (mapped === 'google_not_enabled') return t.login.errors.googleNotEnabled
  return mapped
}

export function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const { t } = useLocale()

  const [emailLoading, setEmailLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const allowedEmail = process.env.NEXT_PUBLIC_ALLOWED_EMAIL ?? ''
  const passkeyEnabled = isPasskeyAuthEnabled()
  const [error, setError] = useState<string | null>(() => {
    const err = searchParams.get('error')
    return err ? resolveLoginError(err, t) : null
  })

  const supabase = createClient()

  async function ensureAllowedSession() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user && !isEmailAllowed(user.email)) {
      await supabase.auth.signOut()
      setError(mapAuthError('unauthorized'))
      return false
    }
    return true
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setError(null)

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: allowedEmail ? { login_hint: allowedEmail } : undefined,
      },
    })

    setGoogleLoading(false)

    if (oauthError) {
      setError(resolveLoginError(oauthError.message, t) || t.login.errors.emailFailed)
    }
  }

  async function handleEmailSignIn() {
    setEmailLoading(true)
    setError(null)
    setEmailSent(false)

    const email = allowedEmail.trim().toLowerCase()
    if (!email) {
      setError('NEXT_PUBLIC_ALLOWED_EMAIL tanımlı değil (.env / Vercel).')
      setEmailLoading(false)
      return
    }

    if (!isEmailAllowed(email)) {
      setError(t.login.errors.emailNotAllowed)
      setEmailLoading(false)
      return
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    setEmailLoading(false)

    if (otpError) {
      setError(resolveLoginError(otpError.message, t) || t.login.errors.emailFailed)
      return
    }

    setEmailSent(true)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <BackgroundCanvas />
      <GlassPanel className="frame-accent relative z-10 w-full max-w-md p-8">
        <div className="text-center">
          <span className="text-4xl text-[var(--accent)]" aria-hidden>
            ✦
          </span>
          <h1 className="mt-4 text-2xl font-bold text-[var(--text)]">{t.login.title}</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{t.login.subtitle}</p>
        </div>

        <div className="mt-8 space-y-3">
          {allowedEmail ? (
            <>
              <Button className="w-full" onClick={handleGoogleSignIn} disabled={googleLoading || emailLoading}>
                {googleLoading ? t.login.googleSigningIn : t.login.googleSignIn}
              </Button>
              <p className="text-center text-xs text-[var(--text-muted)]">{t.login.googleHint}</p>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--border)]" />
                </div>
                <p className="relative mx-auto w-fit bg-[var(--surface)] px-2 text-xs text-[var(--text-muted)]">
                  {t.login.orDivider}
                </p>
              </div>

              {emailSent ? (
                <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  {t.login.emailSent}
                </p>
              ) : (
                <>
                  <p className="text-center font-mono text-sm text-[var(--text)]">{allowedEmail}</p>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={handleEmailSignIn}
                    disabled={emailLoading || googleLoading}
                  >
                    {emailLoading ? t.login.emailSending : t.login.emailSend}
                  </Button>
                  <p className="text-center text-xs text-[var(--text-muted)]">{t.login.emailHint}</p>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-red-700">{t.login.errors.emailNotConfigured}</p>
          )}

          {passkeyEnabled && allowedEmail && (
            <PasskeyLoginSection
              supabase={supabase}
              next={next}
              onError={setError}
              ensureAllowedSession={ensureAllowedSession}
            />
          )}

          <p className="text-center text-xs text-[var(--text-muted)]">{t.login.hint}</p>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{error}</p>
              {error === t.login.errors.googleNotEnabled && (
                <a
                  href={SUPABASE_GOOGLE_PROVIDER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-xs font-medium text-red-900 underline"
                >
                  Supabase Google ayarını aç →
                </a>
              )}
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  )
}
