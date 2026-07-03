'use client'

import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel } from '@aslico/ui'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { useLocale } from '@/components/shell/LocaleProvider'

export function NotFoundView() {
  const { t } = useLocale()

  return (
    <ShellLayout>
      <GlassPanel className="mx-auto max-w-md p-8 text-center">
        <div className="mx-auto w-fit">
          <ModuleGlyph moduleId="language-tutor" size={64} />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-[var(--text)]">{t.notFound.title}</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{t.notFound.description}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm text-[var(--accent)] hover:text-[var(--glow)]"
        >
          {t.common.backToDashboard}
        </Link>
      </GlassPanel>
    </ShellLayout>
  )
}
