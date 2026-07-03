'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isEmailAllowed } from '@/lib/auth/allowlist'

function AuthCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient()
      const code = searchParams.get('code')
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const next = searchParams.get('next') ?? '/dashboard'
      const safeNext = next.startsWith('/') ? next : '/dashboard'

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'email' | 'magiclink' | 'signup' | 'invite' | 'recovery',
          })
          if (error) throw error
        } else {
          throw new Error('auth_callback_failed')
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!isEmailAllowed(user?.email)) {
          await supabase.auth.signOut()
          throw new Error('unauthorized')
        }

        router.replace(safeNext)
        router.refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'auth_callback_failed'
        setStatus('Redirecting…')
        router.replace(`/login?error=${encodeURIComponent(message)}`)
      }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <p className="font-mono text-sm text-[var(--text-muted)]">{status}</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <p className="font-mono text-sm text-[var(--text-muted)]">Loading…</p>
        </div>
      }
    >
      <AuthCallbackHandler />
    </Suspense>
  )
}
