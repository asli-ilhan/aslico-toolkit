'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from './LocaleProvider'

export function AuthNav() {
  const { t } = useLocale()
  const router = useRouter()
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setSignedIn(!!user))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (signedIn) {
    return (
      <button
        type="button"
        onClick={signOut}
        className="transition-colors hover:text-[var(--accent)]"
      >
        {t.passkeys.signOut}
      </button>
    )
  }

  return (
    <Link href="/login" className="transition-colors hover:text-[var(--accent)]">
      {t.nav.signIn}
    </Link>
  )
}
