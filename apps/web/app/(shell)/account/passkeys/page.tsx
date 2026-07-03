'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button } from '@aslico/ui'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/components/shell/LocaleProvider'
import {
  formatAuthApiError,
  formatPasskeyError,
  isWebAuthnSupported,
  isLikelyEmbeddedBrowser,
  embeddedBrowserPasskeyMessage,
} from '@/lib/auth/passkey-errors'
import { registerPlatformPasskey } from '@/lib/auth/passkey-platform'

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

  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [setupHint, setSetupHint] = useState(false)
  const [embeddedBrowser, setEmbeddedBrowser] = useState(false)

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
      }
      setLoading(false)
    }
    load()
  }, [router, supabase.auth])

  async function handleRegister() {
    setRegistering(true)
    setError(null)
    setSuccess(null)
    setSetupHint(false)

    if (!isWebAuthnSupported()) {
      setError('Tarayıcı WebAuthn desteklemiyor. Safari veya Chrome kullan.')
      setRegistering(false)
      return
    }

    if (isLikelyEmbeddedBrowser()) {
      setError(embeddedBrowserPasskeyMessage())
      setRegistering(false)
      return
    }

    if (window.location.hostname === '127.0.0.1') {
      setError('Passkey için http://localhost:3000 kullan (127.0.0.1 değil).')
      setRegistering(false)
      return
    }

    try {
      const { data, error: regError } = await registerPlatformPasskey(supabase)

      if (regError) {
        console.error('registerPasskey error:', regError)
        setError(formatPasskeyError(regError))
        setSetupHint(true)
        setRegistering(false)
        return
      }

      setSuccess(`${t.passkeys.saved}: ${data?.friendly_name ?? data?.id}`)
      const { data: updated } = await supabase.auth.passkey.list()
      setPasskeys(updated ?? [])
    } catch (err) {
      console.error('registerPasskey exception:', err)
      setError(formatPasskeyError(err))
      setSetupHint(true)
    }

    setRegistering(false)
  }

  async function handleDelete(id: string) {
    const { error: delError } = await supabase.auth.passkey.delete({ passkeyId: id })
    if (delError) {
      setError(delError.message)
      return
    }
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
                disabled={registering || embeddedBrowser}
              >
                {registering ? t.passkeys.adding : t.passkeys.add}
              </Button>
            </>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {setupHint && (
            <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-3 text-xs text-[var(--text-muted)]">
              <p className="font-medium text-[var(--text)]">Supabase Passkeys ayarı</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>Authentication → Passkeys → <strong>Enable</strong></li>
                <li>Relying Party ID: <code className="text-[var(--accent)]">{host}</code></li>
                <li>Origin: <code className="text-[var(--accent)]">{origin}</code></li>
                <li>URL: <code className="text-[var(--accent)]">localhost</code> kullan (127.0.0.1 değil)</li>
              </ul>
            </div>
          )}

          {success && (
            <p className="mt-4 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
              {success}
            </p>
          )}
        </GlassPanel>

        <div className="flex gap-3">
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
