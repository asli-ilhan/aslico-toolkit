'use client'

import { DiscoveryScanControls } from './DiscoveryScanControls'
import { launchAutofill } from '@/lib/job-agent/autofill-client'
import { useLocale } from '@/components/shell/LocaleProvider'
import { useState } from 'react'
import { Button } from '@aslico/ui'
import type { useJobDiscoveryScan } from '@/lib/job-agent/use-discovery-scan'

interface DiscoveryPanelProps {
  onComplete: () => void
  onWarning: (msg: string | null) => void
  onRunFinished?: () => void
  compact?: boolean
  discovery?: ReturnType<typeof useJobDiscoveryScan>
}

export function DiscoveryPanel({ onComplete, onWarning, onRunFinished, compact, discovery }: DiscoveryPanelProps) {
  return (
    <DiscoveryScanControls
      compact={compact}
      onComplete={onComplete}
      onWarning={onWarning}
      onRunFinished={onRunFinished}
      discovery={discovery}
    />
  )
}

interface AutofillButtonProps {
  packId: string
  jobUrl: string | null | undefined
  company: string
  role: string
  coverLetter: string
  tailoredCv: string
  blocked?: boolean
}

export function AutofillButton({
  packId,
  jobUrl,
  company,
  role,
  coverLetter,
  tailoredCv,
  blocked,
}: AutofillButtonProps) {
  const { t } = useLocale()
  const ja = t.jobAgent
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleAutofill() {
    if (blocked) {
      setNotice(ja.autofill.blocked)
      return
    }
    if (!jobUrl?.trim()) {
      setNotice(ja.autofill.noUrl)
      return
    }

    setRunning(true)
    setNotice(null)

    const exportRes = await fetch(
      `/api/modules/job-agent/packs/${packId}/export?format=autofill`,
    )
    const packData = await exportRes.json()

    const senderEmail =
      process.env.NEXT_PUBLIC_ALLOWED_EMAIL ??
      (typeof window !== 'undefined' ?
        document.querySelector<HTMLMetaElement>('meta[name="allowed-email"]')?.content
      : undefined)

    const result = await launchAutofill({
      company: packData.company ?? company,
      role: packData.role ?? role,
      jobUrl: jobUrl.trim(),
      coverLetter: packData.coverLetter ?? coverLetter,
      cv: packData.cv ?? tailoredCv,
      notes: packData.notes,
      senderEmail: senderEmail || undefined,
    })

    setRunning(false)

    if (result.ok) {
      setNotice(ja.autofill.success)
    } else {
      setNotice(ja.autofill.daemonRequired)
    }
  }

  return (
    <div className="space-y-1">
      <Button variant="outline" onClick={handleAutofill} disabled={running || blocked}>
        {running ? ja.autofill.running : ja.autofill.run}
      </Button>
      {notice && <p className="text-xs text-[var(--text-muted)]">{notice}</p>}
    </div>
  )
}
