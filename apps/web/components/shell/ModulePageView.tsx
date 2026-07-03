'use client'

import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button } from '@aslico/ui'
import { getModuleById } from '@/lib/module-registry'
import { getModuleView } from '@/lib/module-views'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { useLocale } from '@/components/shell/LocaleProvider'

interface ModulePageViewProps {
  moduleId: string
}

export function ModulePageView({ moduleId }: ModulePageViewProps) {
  const { t } = useLocale()
  const mod = getModuleById(moduleId)
  const ModuleView = getModuleView(moduleId)

  if (!mod) return null

  if (mod.status !== 'coming-soon' && ModuleView) {
    return <ModuleView />
  }

  const localized = t.modules[mod.id]
  const category = t.categories[mod.category] ?? mod.category

  return (
    <ShellLayout>
      <div className="max-w-2xl">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          {t.common.backToDashboard}
        </Link>

        <GlassPanel className="mt-6 p-8">
          <div className="flex items-center gap-4">
            <ModuleGlyph
              moduleId={mod.id}
              primary={mod.accent.primary}
              glow={mod.accent.glow}
              size={72}
            />
            <div>
              <h1 className="text-2xl font-bold text-[var(--text)]">
                {localized?.name ?? mod.name}
              </h1>
              <p className="mt-1 text-sm capitalize text-[var(--text-muted)]">{category}</p>
            </div>
          </div>

          <p className="mt-6 leading-relaxed text-[var(--text-muted)]">
            {localized?.description ?? mod.description}
          </p>

          <div className="mt-8 rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-4">
            <p className="text-sm font-medium text-[var(--text)]">{t.modulePage.statusTitle}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{t.modulePage.statusDescription}</p>
          </div>

          <Button className="mt-6" variant="outline" disabled>
            {t.modulePage.launch}
          </Button>
        </GlassPanel>
      </div>
    </ShellLayout>
  )
}
