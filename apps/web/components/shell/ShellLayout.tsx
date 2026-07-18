'use client'

import Link from 'next/link'
import { BackgroundCanvas } from '@/components/canvas/BackgroundCanvas'
import { AssistantOrb } from '@/components/shell/AssistantOrb'
import { AuthNav } from '@/components/shell/AuthNav'
import { useLocale } from '@/components/shell/LocaleProvider'
import { isPasskeyAuthEnabled } from '@/lib/auth/config'

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLocale()
  const passkeyEnabled = isPasskeyAuthEnabled()

  return (
    <div className="relative min-h-screen">
      <BackgroundCanvas />
      <header className="sticky top-0 z-40 border-b-2 border-[var(--surface-border)] bg-[var(--background)]/85 shadow-[0_1px_0_rgba(249,115,22,0.12)] backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="group flex min-w-0 items-center gap-3">
            <span className="text-2xl text-[var(--accent)]" aria-hidden>
              ✦
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-wide text-[var(--text)] group-hover:text-[var(--glow)]">
                asliCo&apos;s Toolkit
              </p>
              <p className="truncate text-xs text-[var(--text-muted)]">{t.shell.tagline}</p>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--text-muted)]">
            <Link href="/dashboard" className="min-h-9 inline-flex items-center transition-colors hover:text-[var(--accent)]">
              {t.nav.dashboard}
            </Link>
            {passkeyEnabled && (
              <Link
                href="/account/passkeys"
                className="min-h-9 inline-flex items-center transition-colors hover:text-[var(--accent)] md:inline-flex"
              >
                <span className="hidden sm:inline">{t.nav.passkeys}</span>
                <span className="sm:hidden">🔑</span>
              </Link>
            )}
            <AuthNav />
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6">
        {children}
      </main>
      <AssistantOrb />
    </div>
  )
}
