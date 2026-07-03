'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@aslico/ui'
import type { SupabaseClient } from '@supabase/supabase-js'
import { needsTouchIdConfirmStep } from '@/lib/auth/passkey-device'
import {
  embeddedBrowserPasskeyMessage,
  formatPasskeyError,
  isLikelyEmbeddedBrowser,
  isWebAuthnSupported,
} from '@/lib/auth/passkey-errors'
import {
  completePasskeyAuthentication,
  preparePasskeyAuthentication,
  signInWithFingerprint,
  type PreparedPasskeyAuthentication,
} from '@/lib/auth/passkey-platform'
import { useLocale } from '@/components/shell/LocaleProvider'

type Props = {
  supabase: SupabaseClient
  next: string
  onError: (message: string) => void
  ensureAllowedSession: () => Promise<boolean>
}

export function PasskeyLoginSection({ supabase, next, onError, ensureAllowedSession }: Props) {
  const router = useRouter()
  const { t } = useLocale()
  const [loading, setLoading] = useState(false)
  const [touchIdReady, setTouchIdReady] = useState(false)
  const preparedAuthRef = useRef<PreparedPasskeyAuthentication | null>(null)
  const embeddedBrowser = isLikelyEmbeddedBrowser()

  async function finishSignIn(data: { session: unknown } | null) {
    if (!data?.session) return
    const ok = await ensureAllowedSession()
    if (ok) {
      router.push(next)
      router.refresh()
    }
  }

  function mapSignInError(signInError: Error) {
    if (signInError.message?.includes('passkey_disabled')) return t.login.errors.passkeyDisabled
    if (
      signInError.message?.includes('webauthn_credential_not_found') ||
      signInError.message?.includes('parmak izi kaydı yok')
    ) {
      return t.login.errors.passkeyNotFound
    }
    return formatPasskeyError(signInError)
  }

  async function handlePasskeySignIn() {
    onError('')

    if (!isWebAuthnSupported()) {
      onError('Tarayıcı WebAuthn desteklemiyor.')
      return
    }
    if (embeddedBrowser) {
      onError(embeddedBrowserPasskeyMessage())
      return
    }
    if (window.location.hostname === '127.0.0.1') {
      onError('http://localhost:3000 kullan.')
      return
    }

    if (touchIdReady && preparedAuthRef.current) {
      setLoading(true)
      try {
        const { data, error: signInError } = await completePasskeyAuthentication(
          supabase,
          preparedAuthRef.current,
        )
        preparedAuthRef.current = null
        setTouchIdReady(false)
        if (signInError) {
          onError(mapSignInError(signInError))
          return
        }
        await finishSignIn(data)
      } catch (err) {
        onError(formatPasskeyError(err))
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      if (needsTouchIdConfirmStep()) {
        const { data: prepared, error: prepError } = await preparePasskeyAuthentication(supabase)
        if (prepError || !prepared) {
          onError(mapSignInError(prepError ?? new Error('Hazırlık başarısız')))
          return
        }
        preparedAuthRef.current = prepared
        setTouchIdReady(true)
        return
      }

      const { data, error: signInError } = await signInWithFingerprint(supabase)
      if (signInError) {
        onError(mapSignInError(signInError))
        return
      }
      await finishSignIn(data)
    } catch (err) {
      onError(formatPasskeyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-3">
      <p className="text-center text-xs text-[var(--text-muted)]">{t.login.passkeyOptional}</p>
      {touchIdReady && (
        <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--text)]">
          {t.login.touchIdConfirmHint}
        </p>
      )}
      <Button
        variant="ghost"
        className="w-full"
        onClick={handlePasskeySignIn}
        disabled={loading || embeddedBrowser}
      >
        {touchIdReady ? t.login.touchIdConfirm : loading ? t.login.touchIdWaiting : t.login.touchIdButton}
      </Button>
      <p className="text-center text-xs text-[var(--text-muted)]">{t.login.passkeyDomainWarning}</p>
    </div>
  )
}
