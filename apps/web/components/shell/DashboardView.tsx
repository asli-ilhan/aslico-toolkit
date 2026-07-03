'use client'

import { ShellLayout } from '@/components/shell/ShellLayout'
import { DailyBriefing } from '@/components/shell/DailyBriefing'
import { ModuleLauncher } from '@/components/shell/ModuleLauncher'
import { moduleRegistry } from '@/lib/module-registry'
import { useLocale } from '@/components/shell/LocaleProvider'

export function DashboardView() {
  const { t } = useLocale()

  return (
    <ShellLayout>
      <div className="space-y-8">
        <section>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">{t.dashboard.welcome}</h1>
          <p className="mt-2 max-w-xl text-[var(--text-muted)]">{t.dashboard.subtitle}</p>
        </section>

        <DailyBriefing />

        <section>
          <h2 className="mb-4 text-xl font-semibold text-[var(--text)]">{t.dashboard.modules}</h2>
          <ModuleLauncher modules={moduleRegistry} />
        </section>
      </div>
    </ShellLayout>
  )
}
