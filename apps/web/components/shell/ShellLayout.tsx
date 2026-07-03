'use client'

import Link from 'next/link'
import { BackgroundCanvas } from '@/components/canvas/BackgroundCanvas'
import { AssistantOrb } from '@/components/shell/AssistantOrb'
import { AuthNav } from '@/components/shell/AuthNav'
import { useLocale } from '@/components/shell/LocaleProvider'

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLocale()

  return (
    <div className="relative min-h-screen">
      <BackgroundCanvas />
      <header className="sticky top-0 z-40 border-b-2 border-[var(--surface-border)] bg-[var(--background)]/85 shadow-[0_1px_0_rgba(249,115,22,0.12)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="group flex items-center gap-3">
            <span className="text-2xl text-[var(--accent)]" aria-hidden>
              ✦
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide text-[var(--text)] group-hover:text-[var(--glow)]">
                asliCo&apos;s Toolkit
              </p>
              <p className="text-xs text-[var(--text-muted)]">{t.shell.tagline}</p>
            </div>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
            <Link href="/dashboard" className="transition-colors hover:text-[var(--accent)]">
              {t.nav.dashboard}
            </Link>
            <Link href="/account/passkeys" className="transition-colors hover:text-[var(--accent)]">
              {t.nav.passkeys}
            </Link>
            <AuthNav />
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8">{children}</main>
      <AssistantOrb />
    </div>
  )
}
