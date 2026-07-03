'use client'

import { useCallback, useState } from 'react'
import { Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { launchAutofill } from '@/lib/job-agent/autofill-client'

interface DiscoveryPanelProps {
  onComplete: () => void
  onWarning: (msg: string | null) => void
  compact?: boolean
}

export function DiscoveryPanel({ onComplete, onWarning, compact }: DiscoveryPanelProps) {
  const { t } = useLocale()
  const ja = t.jobAgent
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string | null>(null)

  const runDiscovery = useCallback(async () => {
    setRunning(true)
    setLog(null)
    onWarning(null)

    const res = await fetch('/api/modules/job-agent/nightly', { method: 'POST' })
    const data = await res.json()

    setRunning(false)

    if (data.warning === 'job_agent_v2_missing') {
      onWarning(ja.warnings.v2Missing)
      return
    }

    if (data.log?.length) {
      setLog(data.log.map((l: { message: string }) => l.message).join('\n'))
    }

    if (data.packsCreated > 0) {
      onComplete()
    }
  }, [ja.warnings.v2Missing, onComplete, onWarning])

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <p className="text-sm text-[var(--text-muted)]">{ja.discovery.hint}</p>
      <Button onClick={runDiscovery} disabled={running}>
        {running ? ja.discovery.running : ja.discovery.runNow}
      </Button>
      {log && (
        <pre className="max-h-40 overflow-auto rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-3 text-xs text-[var(--text-muted)]">
          {log}
        </pre>
      )}
    </div>
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
