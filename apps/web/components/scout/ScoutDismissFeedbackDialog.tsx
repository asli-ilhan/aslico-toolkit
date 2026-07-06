'use client'

import { useEffect, useState } from 'react'
import { Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'

export interface ScoutDismissFeedbackDialogProps {
  open: boolean
  title: string
  subtitle?: string | null
  onCancel: () => void
  onConfirm: (feedback: string) => void | Promise<void>
  busy?: boolean
}

export function ScoutDismissFeedbackDialog({
  open,
  title,
  subtitle,
  onCancel,
  onConfirm,
  busy = false,
}: ScoutDismissFeedbackDialogProps) {
  const { t } = useLocale()
  const sf = t.scoutFeedback
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (open) setFeedback('')
  }, [open, title])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scout-feedback-title"
        className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--background)] p-4 shadow-xl"
      >
        <h3 id="scout-feedback-title" className="text-sm font-semibold text-[var(--text)]">
          {sf.title}
        </h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{sf.hint}</p>
        <p className="mt-2 text-sm font-medium text-[var(--text)]">
          {subtitle ? `${subtitle} · ${title}` : title}
        </p>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          placeholder={sf.placeholder}
          className="mt-3 w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
          autoFocus
        />
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {sf.cancel}
          </Button>
          <Button
            variant="outline"
            onClick={() => onConfirm('')}
            disabled={busy}
          >
            {sf.dismissWithout}
          </Button>
          <Button
            onClick={() => onConfirm(feedback)}
            disabled={busy || !feedback.trim()}
          >
            {busy ? t.common.loading : sf.submit}
          </Button>
        </div>
      </div>
    </div>
  )
}
