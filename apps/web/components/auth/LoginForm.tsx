'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BackgroundCanvas } from '@/components/canvas/BackgroundCanvas'
import { GlassPanel, Button } from '@aslico/ui'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/components/shell/LocaleProvider'
import { isEmailAllowed, mapAuthError } from '@/lib/auth/allowlist'
import {
  embeddedBrowserPasskeyMessage,
  formatPasskeyError,
  isLikelyEmbeddedBrowser,
  isWebAuthnSupported,
} from '@/lib/auth/passkey-errors'
import { signInWithFingerprint } from '@/lib/auth/passkey-platform'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const { t } = useLocale()

  const [loading, setLoading] = useState(false)
  const [embeddedBrowser, setEmbeddedBrowser] = useState(false)
  const isDev = process.env.NODE_ENV === 'development'
  const [error, setError] = useState<string | null>(
    searchParams.get('error') ? mapAuthError(searchParams.get('error')!) : null,
  )

  useEffect(() => {
    setEmbeddedBrowser(isLikelyEmbeddedBrowser())
  }, [])

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

  async function handlePasskeySignIn() {
    setLoading(true)
    setError(null)

    if (!isWebAuthnSupported()) {
      setError('Tarayıcı WebAuthn desteklemiyor. Safari veya Chrome kullan.')
      setLoading(false)
      return
    }

    if (isLikelyEmbeddedBrowser()) {
      setError(embeddedBrowserPasskeyMessage())
      setLoading(false)
      return
    }

    if (window.location.hostname === '127.0.0.1') {
      setError('Passkey için http://localhost:3000 kullan (127.0.0.1 değil).')
      setLoading(false)
      return
    }

    const { data, error: signInError } = await signInWithFingerprint(supabase)

    if (signInError) {
      setLoading(false)
      const msg = formatPasskeyError(signInError)
      if (signInError.message?.includes('passkey_disabled')) {
        setError(t.login.errors.passkeyDisabled)
      } else if (signInError.message?.includes('webauthn_credential_not_found')) {
        setError(t.login.errors.passkeyNotFound)
      } else {
        setError(msg)
      }
      return
    }

    if (data.session) {
      const ok = await ensureAllowedSession()
      setLoading(false)
      if (ok) {
        router.push(next)
        router.refresh()
      }
    } else {
      setLoading(false)
    }
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
          {embeddedBrowser && (
            <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--text)]">
              {embeddedBrowserPasskeyMessage()}
            </div>
          )}
          <Button className="w-full" onClick={handlePasskeySignIn} disabled={loading || embeddedBrowser}>
            {loading ? t.login.touchIdWaiting : t.login.touchIdButton}
          </Button>
          {isDev && (
            <a
              href="/api/auth/setup"
              className="block text-center text-xs text-[var(--accent)] hover:underline"
            >
              {t.login.devSetup}
            </a>
          )}
          <p className="text-center text-xs text-[var(--text-muted)]">{t.login.hint}</p>
          <p className="text-center text-xs text-[var(--text-muted)]">{t.login.touchIdExplain}</p>

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
