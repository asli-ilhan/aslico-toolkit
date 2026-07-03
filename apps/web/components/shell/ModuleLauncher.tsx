'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import type { ModuleManifest } from '@aslico/core/module-sdk'
import { GlassPanel, cn } from '@aslico/ui'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { useLocale } from './LocaleProvider'

interface ModuleLauncherProps {
  modules: ModuleManifest[]
}

export function ModuleLauncher({ modules }: ModuleLauncherProps) {
  const { t } = useLocale()

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {modules.map((mod, i) => {
        const localized = t.modules[mod.id]
        const category = t.categories[mod.category] ?? mod.category

        return (
          <motion.div
            key={mod.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
          >
            <Link href={mod.href} className="block h-full">
              <GlassPanel
                className={cn(
                  'group h-full p-5 transition-all duration-300',
                  'hover:border-[var(--accent)] hover:shadow-[0_0_32px_var(--accent-soft)]',
                )}
              >
                <div className="flex items-start justify-between">
                  <ModuleGlyph
                    moduleId={mod.id}
                    primary={mod.accent.primary}
                    glow={mod.accent.glow}
                    size={52}
                  />
                  {mod.status === 'coming-soon' && (
                    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">
                      {t.common.soon}
                    </span>
                  )}
                  {mod.status === 'beta' && (
                    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">
                      {t.common.beta}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--text)] group-hover:text-[var(--glow)]">
                  {localized?.name ?? mod.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  {localized?.description ?? mod.description}
                </p>
                <p className="mt-3 text-xs capitalize text-[var(--text-muted)] opacity-60">{category}</p>
              </GlassPanel>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}
