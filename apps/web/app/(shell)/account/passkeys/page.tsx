'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button } from '@aslico/ui'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/components/shell/LocaleProvider'
import { isPasskeyAuthEnabled } from '@/lib/auth/config'
import {
  formatAuthApiError,
  formatPasskeyError,
  isWebAuthnSupported,
  isLikelyEmbeddedBrowser,
  embeddedBrowserPasskeyMessage,
} from '@/lib/auth/passkey-errors'
import { clearLocalPasskeyId, loadLocalPasskeyId, needsTouchIdConfirmStep } from '@/lib/auth/passkey-device'
import type { RpDiagnosis } from '@/lib/auth/passkey-rp-check'
import { checkCreationRpId } from '@/lib/auth/passkey-rp-check'
import {
  completePasskeyRegistration,
  preparePasskeyRegistration,
  registerPlatformPasskey,
  type PreparedPasskeyRegistration,
} from '@/lib/auth/passkey-platform'

const SUPABASE_PASSKEYS_URL =
  'https://supabase.com/dashboard/project/uhepdwjqkyjdiaugtjln/auth/passkeys'

interface PasskeyItem {
  id: string
  friendly_name?: string
  created_at: string
  last_used_at?: string
}

export default function PasskeysPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t, locale } = useLocale()
  const passkeyEnabled = isPasskeyAuthEnabled()

  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [setupHint, setSetupHint] = useState(false)
  const [embeddedBrowser, setEmbeddedBrowser] = useState(false)
  const [touchIdReady, setTouchIdReady] = useState(false)
  const [needsRelink, setNeedsRelink] = useState(false)
  const [rpDiagnosis, setRpDiagnosis] = useState<RpDiagnosis | null>(null)
  const preparedRegistrationRef = useRef<PreparedPasskeyRegistration | null>(null)

  useEffect(() => {
    if (!passkeyEnabled) {
      router.replace('/dashboard')
    }
  }, [router, passkeyEnabled])

  useEffect(() => {
    setEmbeddedBrowser(isLikelyEmbeddedBrowser())
  }, [])

  const dateLocale =
    locale === 'tr'
      ? 'tr-TR'
      : locale === 'fr'
        ? 'fr-FR'
        : locale === 'es'
          ? 'es-ES'
          : locale === 'ar'
            ? 'ar'
            : 'en-US'

  useEffect(() => {
    if (!passkeyEnabled) return

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?next=/account/passkeys')
        return
      }

      const { data, error: listError } = await supabase.auth.passkey.list()
      if (listError) {
        setError(formatAuthApiError(listError))
        if (listError.message?.includes('passkey_disabled')) setSetupHint(true)
      } else {
        setPasskeys(data ?? [])
        setNeedsRelink((data?.length ?? 0) > 0 && !loadLocalPasskeyId())
      }

      const { data: prepared, error: prepError } = await preparePasskeyRegistration(supabase)
      if (prepError) {
        if (prepError.message?.includes('passkey_disabled')) {
          setSetupHint(true)
          setError(formatPasskeyError(prepError))
        } else if (
          prepError.message.includes('RP ID') ||
          prepError.message.includes('localhost')
        ) {
          setSetupHint(true)
          setError(prepError.message)
        }
      } else if (prepared) {
        const diagnosis = checkCreationRpId(prepared.publicKey)
        setRpDiagnosis(diagnosis)
        if (!diagnosis.matches) {
          setSetupHint(true)
          setError(diagnosis.fixMessage)
        }
      }

      setLoading(false)
    }
    load()
  }, [router, supabase.auth, passkeyEnabled])

  if (!passkeyEnabled) {
    return null
  }

  async function handleRegister() {
    setError(null)
    setSuccess(null)
    setSetupHint(false)

    if (!isWebAuthnSupported()) {
      setError('Tarayıcı WebAuthn desteklemiyor. Safari veya Chrome kullan.')
      return
    }

    if (isLikelyEmbeddedBrowser()) {
      setError(embeddedBrowserPasskeyMessage())
      return
    }

    if (window.location.hostname === '127.0.0.1') {
      setError('Passkey için http://localhost:3000 kullan (127.0.0.1 değil).')
      return
    }

    if (touchIdReady && preparedRegistrationRef.current) {
      setRegistering(true)
      try {
        const { data, error: regError } = await completePasskeyRegistration(
          supabase,
          preparedRegistrationRef.current,
        )
        preparedRegistrationRef.current = null
        setTouchIdReady(false)

        if (regError) {
          console.error('registerPasskey error:', regError)
          setError(formatPasskeyError(regError))
          setSetupHint(true)
          return
        }

        setSuccess(`${t.passkeys.saved}: ${data?.friendly_name ?? data?.id}`)
        const { data: updated } = await supabase.auth.passkey.list()
        setPasskeys(updated ?? [])
        setNeedsRelink(false)
      } catch (err) {
        console.error('registerPasskey exception:', err)
        setError(formatPasskeyError(err))
        setSetupHint(true)
      } finally {
        setRegistering(false)
      }
      return
    }

    setRegistering(true)

    try {
      if (needsTouchIdConfirmStep()) {
        const { data: prepared, error: prepError } = await preparePasskeyRegistration(supabase)
        if (prepError || !prepared) {
          setError(formatPasskeyError(prepError ?? new Error('Hazırlık başarısız')))
          setSetupHint(true)
          return
        }
        preparedRegistrationRef.current = prepared
        setTouchIdReady(true)
        return
      }

      const { data, error: regError } = await registerPlatformPasskey(supabase)

      if (regError) {
        console.error('registerPasskey error:', regError)
        setError(formatPasskeyError(regError))
        setSetupHint(true)
        return
      }

      setSuccess(`${t.passkeys.saved}: ${data?.friendly_name ?? data?.id}`)
      const { data: updated } = await supabase.auth.passkey.list()
      setPasskeys(updated ?? [])
      setNeedsRelink(false)
    } catch (err) {
      console.error('registerPasskey exception:', err)
      setError(formatPasskeyError(err))
      setSetupHint(true)
    } finally {
      setRegistering(false)
    }
  }

  async function handleDelete(id: string) {
    const { error: delError } = await supabase.auth.passkey.delete({ passkeyId: id })
    if (delError) {
      setError(delError.message)
      return
    }
    clearLocalPasskeyId()
    setPasskeys((prev) => prev.filter((p) => p.id !== id))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

  return (
    <ShellLayout>
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{t.passkeys.title}</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{t.passkeys.subtitle}</p>
        </div>

        <GlassPanel className="p-6">
          {embeddedBrowser && (
            <div className="mb-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
              {embeddedBrowserPasskeyMessage()}
            </div>
          )}

          {rpDiagnosis && !rpDiagnosis.matches && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-900">
              <p className="font-medium">Supabase ayarı uyuşmuyor</p>
              <p className="mt-1 text-xs">
                Supabase RP ID: <strong>{rpDiagnosis.serverRpId ?? '?'}</strong> → olması gereken:{' '}
                <strong>{rpDiagnosis.hostname}</strong>
              </p>
              <p className="mt-2 text-xs">{rpDiagnosis.fixMessage}</p>
              <a
                href={SUPABASE_PASSKEYS_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-red-800 underline"
              >
                Supabase Passkeys ayarını aç →
              </a>
            </div>
          )}

          {needsRelink && (
            <p className="mb-4 rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {t.passkeys.relinkHint}
            </p>
          )}

          {passkeys.length > 0 && (
            <p className="mb-4 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 px-3 py-2 text-xs text-[var(--text-muted)]">
              {t.passkeys.deleteQrHint}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
          ) : (
            <>
              {passkeys.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t.passkeys.empty}</p>
              ) : (
                <ul className="space-y-3">
                  {passkeys.map((pk) => (
                    <li
                      key={pk.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--surface-border)] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">
                          {pk.friendly_name ?? t.passkeys.defaultName}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {new Date(pk.created_at).toLocaleDateString(dateLocale)}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(pk.id)}>
                        {t.common.delete}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                className="mt-4 w-full"
                onClick={handleRegister}
                disabled={registering || embeddedBrowser || (rpDiagnosis !== null && !rpDiagnosis.matches)}
              >
                {touchIdReady
                  ? t.login.touchIdConfirm
                  : registering
                    ? t.passkeys.adding
                    : t.passkeys.add}
              </Button>
              {touchIdReady && (
                <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
                  {t.login.touchIdConfirmHint}
                </p>
              )}
            </>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {setupHint && (
            <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-3 text-xs text-[var(--text-muted)]">
              <p className="font-medium text-[var(--text)]">Supabase Passkeys — adım adım</p>
              <ol className="mt-2 list-inside list-decimal space-y-1">
                <li>
                  <a href={SUPABASE_PASSKEYS_URL} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
                    Passkeys sayfasını aç
                  </a>
                </li>
                <li>
                  <strong>Enable Passkey authentication</strong> → AÇ
                </li>
                <li>
                  Relying Party ID: <code className="text-[var(--accent)]">{host}</code>
                </li>
                <li>
                  Relying Party Origins: <code className="text-[var(--accent)]">{origin}</code>
                </li>
                <li>Kaydet → bu sayfayı yenile (Safari, localhost:3000)</li>
              </ol>
              {rpDiagnosis?.serverRpId && rpDiagnosis.serverRpId !== host && (
                <p className="mt-2 text-amber-800">
                  Şu an Supabase’de: <code>{rpDiagnosis.serverRpId}</code> — değiştirmen lazım.
                </p>
              )}
            </div>
          )}

          {success && (
            <p className="mt-4 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
              {success}
            </p>
          )}
        </GlassPanel>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            {t.common.dashboard}
          </Button>
          <Button variant="ghost" onClick={handleSignOut}>
            {t.passkeys.signOut}
          </Button>
        </div>
      </div>
    </ShellLayout>
  )
}
