'use client'

import { useCallback, useState } from 'react'
import { ScoutDismissFeedbackDialog } from '@/components/scout/ScoutDismissFeedbackDialog'
import { submitScoutScopeFeedback } from '@/lib/scout/submit-scope-feedback'
import type { ScoutFeedbackAction } from '@/lib/scout/scope-feedback'
import type { ScoutModuleId } from '@/lib/scout/skipped'

export interface DismissFeedbackTarget {
  action: ScoutFeedbackAction
  title: string
  subtitle?: string | null
  itemUrl?: string | null
  skipCategory?: string | null
  onConfirm: () => void | Promise<void>
}

export function useDismissWithFeedback(moduleId: ScoutModuleId) {
  const [pending, setPending] = useState<DismissFeedbackTarget | null>(null)
  const [busy, setBusy] = useState(false)

  const openDismiss = useCallback((target: DismissFeedbackTarget) => {
    setPending(target)
  }, [])

  const close = useCallback(() => {
    if (!busy) setPending(null)
  }, [busy])

  const handleConfirm = useCallback(async (feedback: string) => {
    if (!pending) return
    setBusy(true)
    try {
      if (feedback.trim()) {
        await submitScoutScopeFeedback({
          moduleId,
          action: pending.action,
          title: pending.title,
          subtitle: pending.subtitle,
          itemUrl: pending.itemUrl,
          skipCategory: pending.skipCategory,
          feedback,
        })
      }
      await pending.onConfirm()
      setPending(null)
    } finally {
      setBusy(false)
    }
  }, [moduleId, pending])

  const dialog = (
    <ScoutDismissFeedbackDialog
      open={!!pending}
      title={pending?.title ?? ''}
      subtitle={pending?.subtitle}
      onCancel={close}
      onConfirm={handleConfirm}
      busy={busy}
    />
  )

  return { openDismiss, dialog }
}
