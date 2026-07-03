'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AssistantOrb3D } from '@/components/canvas/AssistantOrb3D'
import { GlassPanel } from '@aslico/ui'
import { useLocale } from './LocaleProvider'

export function AssistantOrb() {
  const [open, setOpen] = useState(false)
  const { t } = useLocale()

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-72"
          >
            <GlassPanel className="p-4">
              <p className="text-sm font-medium text-[var(--text)]">{t.assistant.title}</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{t.assistant.description}</p>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="rounded-full p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={t.assistant.ariaLabel}
      >
        <AssistantOrb3D />
      </motion.button>
    </div>
  )
}
