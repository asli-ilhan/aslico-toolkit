'use client'

import { useState } from 'react'
import { Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import type { ApplicationPack } from './types'
import { RiskBadge } from './RiskBadge'
import { OutreachPanel } from './OutreachPanel'
import { AutofillButton } from './DiscoveryPanel'

interface PackDetailPanelProps {
  pack: ApplicationPack
  editable?: boolean
  onUpdate: (patch: Partial<ApplicationPack> & { status?: string; funnel_stage?: string }) => Promise<void>
  onRemove?: () => void
}

const FUNNEL_STAGES = ['none', 'applied', 'screening', 'interview', 'offer', 'rejected'] as const

export function PackDetailPanel({ pack, editable = false, onUpdate, onRemove }: PackDetailPanelProps) {
  const { t } = useLocale()
  const ja = t.jobAgent
  const [coverLetter, setCoverLetter] = useState(pack.cover_letter ?? '')
  const [tailoredCv, setTailoredCv] = useState(pack.tailored_cv ?? '')
  const [notes, setNotes] = useState(pack.notes ?? '')
  const [deadlineAt, setDeadlineAt] = useState(pack.deadline_at?.slice(0, 10) ?? '')
  const [followUpAt, setFollowUpAt] = useState(pack.follow_up_at?.slice(0, 10) ?? '')
  const [emailDraft, setEmailDraft] = useState(pack.email_draft ?? '')
  const [saving, setSaving] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)

  async function saveEdits() {
    setSaving(true)
    await onUpdate({
      cover_letter: coverLetter,
      tailored_cv: tailoredCv,
      notes,
      deadline_at: deadlineAt ? new Date(deadlineAt).toISOString() : null,
      follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
      email_draft: emailDraft,
    } as Partial<ApplicationPack>)
    setSaving(false)
  }

  async function generateEmail() {
    setEmailLoading(true)
    const res = await fetch(`/api/modules/job-agent/packs/${pack.id}/email`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) setEmailDraft(data.emailDraft)
    setEmailLoading(false)
  }

  function openExport(format: 'html' | 'md' | 'autofill' | 'pdf' | 'ics', icsKind?: 'deadline' | 'followup') {
    if (format === 'autofill') {
      window.open(`/api/modules/job-agent/packs/${pack.id}/export?format=autofill`, '_blank')
      return
    }
    if (format === 'ics') {
      window.open(
        `/api/modules/job-agent/packs/${pack.id}/export?format=ics&kind=${icsKind ?? 'followup'}`,
        '_blank',
      )
      return
    }
    window.open(`/api/modules/job-agent/packs/${pack.id}/export?format=${format}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {pack.company} · {pack.role}
          </h2>
          {pack.fit_reason && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">{pack.fit_reason}</p>
          )}
          {pack.fit_score != null && (
            <p className="mt-1 text-xs text-[var(--accent)]">
              {ja.inbox.fit}: {Math.round(pack.fit_score)}%
            </p>
          )}
          <RiskBadge level={pack.ai_risk_level} reason={pack.ai_risk_reason} />
          {pack.auto_submit_blocked && (
            <p className="mt-2 text-xs text-[var(--accent)]">{ja.inbox.gigGuard}</p>
          )}
          {pack.profile_variant && pack.profile_variant !== 'default' && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {ja.profile.variant}: {pack.profile_variant}
            </p>
          )}
        </div>
        {pack.job_url && (
          <a
            href={pack.job_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--accent)] hover:underline"
          >
            {pack.job_url}
          </a>
        )}
      </div>

      {pack.domain_fit && Object.keys(pack.domain_fit).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(pack.domain_fit).map(([d, v]) => (
            <span
              key={d}
              className="rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] text-[var(--accent)]"
            >
              {d}: {v}%
            </span>
          ))}
        </div>
      )}

      <label className="block text-sm text-[var(--text)]">
        {ja.inbox.notes}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          readOnly={!editable}
          className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm text-[var(--text)]">
        {ja.inbox.deadline}
        <input
          type="date"
          value={deadlineAt}
          onChange={(e) => setDeadlineAt(e.target.value)}
          disabled={!editable}
          className="mt-1 rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm text-[var(--text)]">
        {ja.inbox.followUp}
        <input
          type="date"
          value={followUpAt}
          onChange={(e) => setFollowUpAt(e.target.value)}
          disabled={!editable}
          className="mt-1 rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
        />
      </label>

      <div>
        <h3 className="text-sm font-medium text-[var(--text)]">{ja.coverLetter}</h3>
        <textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          readOnly={!editable}
          rows={8}
          className="mt-2 w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-4 text-sm leading-relaxed"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--text)]">{ja.cvTips}</h3>
        <textarea
          value={tailoredCv}
          onChange={(e) => setTailoredCv(e.target.value)}
          readOnly={!editable}
          rows={10}
          className="mt-2 w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-4 text-sm leading-relaxed text-[var(--text-muted)]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--text)]">{ja.inbox.emailDraft}</h3>
          <Button variant="ghost" size="sm" onClick={generateEmail} disabled={emailLoading}>
            {emailLoading ? ja.inbox.emailGenerating : ja.inbox.emailGenerate}
          </Button>
        </div>
        <textarea
          value={emailDraft}
          onChange={(e) => setEmailDraft(e.target.value)}
          rows={6}
          className="mt-2 w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-4 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {editable && (
          <>
            <Button onClick={() => onUpdate({ status: 'approved' })}>{ja.inbox.approve}</Button>
            <Button
              onClick={() => onUpdate({ status: 'submitted' })}
              disabled={pack.auto_submit_blocked === true}
            >
              {ja.inbox.markSubmitted}
            </Button>
            <Button variant="outline" onClick={() => onUpdate({ status: 'skipped' })}>
              {ja.inbox.skip}
            </Button>
            <Button variant="outline" onClick={saveEdits} disabled={saving}>
              {saving ? t.common.loading : ja.inbox.saveEdits}
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={() => navigator.clipboard.writeText(coverLetter)}>
          {ja.copy} ({ja.coverLetter})
        </Button>
        <Button variant="ghost" onClick={() => navigator.clipboard.writeText(tailoredCv)}>
          {ja.copy} ({ja.cvTips})
        </Button>
        <Button variant="ghost" onClick={() => openExport('pdf')}>
          {ja.inbox.exportPdf}
        </Button>
        <Button variant="ghost" onClick={() => openExport('html')}>
          {ja.inbox.exportPrint}
        </Button>
        <Button variant="ghost" onClick={() => openExport('md')}>
          {ja.inbox.exportMd}
        </Button>
        <AutofillButton
          packId={pack.id}
          jobUrl={pack.job_url}
          company={pack.company}
          role={pack.role}
          coverLetter={coverLetter}
          tailoredCv={tailoredCv}
          blocked={pack.auto_submit_blocked === true}
        />
        <Button variant="ghost" onClick={() => openExport('ics', 'deadline')}>
          {ja.inbox.exportIcs} ({ja.inbox.exportIcsDeadline})
        </Button>
        <Button variant="ghost" onClick={() => openExport('ics', 'followup')}>
          {ja.inbox.exportIcs} ({ja.inbox.exportIcsFollowup})
        </Button>
        {onRemove && (
          <Button variant="ghost" onClick={onRemove}>
            {t.common.delete}
          </Button>
        )}
      </div>

      <OutreachPanel packId={pack.id} packStatus={pack.status} />

      {!editable && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--surface-border)] pt-3">
          <span className="text-xs text-[var(--text-muted)]">{ja.history.funnel}:</span>
          {FUNNEL_STAGES.filter((s) => s !== 'none').map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => onUpdate({ funnel_stage: stage })}
              className={
                pack.funnel_stage === stage
                  ? 'rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)]'
                  : 'rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent)]'
              }
            >
              {ja.history.funnelStages[stage as keyof typeof ja.history.funnelStages]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
