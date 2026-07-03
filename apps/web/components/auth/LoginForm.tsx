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

export function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const { t } = useLocale()

  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const allowedEmail = process.env.NEXT_PUBLIC_ALLOWED_EMAIL ?? ''
  const passkeyEnabled = isPasskeyAuthEnabled()
  const [error, setError] = useState<string | null>(
    searchParams.get('error') ? mapAuthError(searchParams.get('error')!) : null,
  )

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
      setError(mapAuthError(otpError.message) || t.login.errors.emailFailed)
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
            emailSent ? (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                {t.login.emailSent}
              </p>
            ) : (
              <>
                <p className="text-center font-mono text-sm text-[var(--text)]">{allowedEmail}</p>
                <Button className="w-full" onClick={handleEmailSignIn} disabled={emailLoading}>
                  {emailLoading ? t.login.emailSending : t.login.emailSend}
                </Button>
                <p className="text-center text-xs text-[var(--text-muted)]">{t.login.emailHint}</p>
              </>
            )
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
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </GlassPanel>
    </div>
  )
}
