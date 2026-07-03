'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'

interface OutreachRecipient {
  id: string
  name: string | null
  title: string | null
  email: string
  source: string
  relevance_score: number | null
  sent_at: string | null
  error: string | null
}

interface OutreachCampaign {
  id: string
  status: string
  subject: string | null
  body: string | null
  error: string | null
  sent_at: string | null
}

interface OutreachPanelProps {
  packId: string
  packStatus: string
}

export function OutreachPanel({ packId, packStatus }: OutreachPanelProps) {
  const { t } = useLocale()
  const o = t.jobAgent.outreach
  const [campaign, setCampaign] = useState<OutreachCampaign | null>(null)
  const [recipients, setRecipients] = useState<OutreachRecipient[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [outRes, gmailRes] = await Promise.all([
      fetch(`/api/modules/job-agent/packs/${packId}/outreach`),
      fetch('/api/modules/job-agent/gmail'),
    ])

    const outData = await outRes.json()
    const gmailData = await gmailRes.json()

    if (outData.warning === 'job_agent_v4_missing') {
      setWarning(t.jobAgent.warnings.v4Missing)
    }
    if (gmailData.warning === 'job_agent_v4_missing') {
      setWarning(t.jobAgent.warnings.v4Missing)
    }

    setCampaign(outData.campaign ?? null)
    setRecipients(outData.recipients ?? [])
    setSubject(outData.campaign?.subject ?? '')
    setBody(outData.campaign?.body ?? '')
    setGmailConnected(Boolean(gmailData.connected))
    setGmailEmail(gmailData.email ?? null)
    setLoading(false)
  }, [packId, t.jobAgent.warnings.v4Missing])

  useEffect(() => {
    if (packStatus === 'submitted' || packStatus === 'approved') {
      load()
    }
  }, [load, packStatus])

  async function saveDraft() {
    setSaving(true)
    await fetch(`/api/modules/job-agent/packs/${packId}/outreach`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    })
    setSaving(false)
    load()
  }

  async function rediscover() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/modules/job-agent/packs/${packId}/outreach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'discover' }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) setError(data.error ?? o.errors.discoverFailed)
    else load()
  }

  async function approveAndSend() {
    if (!gmailConnected) {
      setError(o.errors.gmailRequired)
      return
    }
    setSending(true)
    setError(null)
    const res = await fetch(`/api/modules/job-agent/packs/${packId}/outreach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', subject, body }),
    })
    const data = await res.json()
    setSending(false)
    if (!res.ok) {
      setError(data.error ?? o.errors.sendFailed)
      return
    }
    if (data.failed?.length) {
      setError(data.failed.join('; '))
    }
    load()
  }

  if (packStatus !== 'submitted' && packStatus !== 'approved' && !campaign) {
    return null
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
  }

  return (
    <div className="space-y-4 border-t border-[var(--surface-border)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">{o.title}</h3>
        {campaign?.status && (
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--accent)]">
            {campaign.status}
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)]">{o.hint}</p>

      {warning && (
        <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--text)]">
          {warning}
        </p>
      )}

      {!gmailConnected ? (
        <div className="rounded-xl border border-[var(--surface-border)] p-3">
          <p className="text-sm text-[var(--text-muted)]">{o.gmailDisconnected}</p>
          <a
            href="/api/auth/gmail/connect"
            className="mt-2 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
          >
            {o.connectGmail}
          </a>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">
          {o.sendingFrom}: <span className="text-[var(--accent)]">{gmailEmail}</span>
        </p>
      )}

      {campaign?.status === 'discovering' && (
        <p className="text-sm text-[var(--text-muted)]">{o.discovering}</p>
      )}

      {campaign?.error && (
        <p className="text-sm text-red-700">{campaign.error}</p>
      )}

      {recipients.length > 0 && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {o.recipients} ({recipients.length})
          </h4>
          <ul className="mt-2 space-y-1">
            {recipients.map((r) => (
              <li key={r.id} className="text-sm text-[var(--text)]">
                {r.name ?? r.email} · {r.title ?? r.source}{' '}
                <span className="text-[var(--text-muted)]">&lt;{r.email}&gt;</span>
                {r.sent_at && (
                  <span className="ml-2 text-xs text-[var(--accent)]">{o.sent}</span>
                )}
                {r.error && <span className="ml-2 text-xs text-red-700">{r.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(campaign?.status === 'draft_ready' || campaign?.status === 'failed' || campaign?.status === 'sent') && (
        <>
          <label className="block text-sm text-[var(--text)]">
            {o.subject}
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={campaign.status === 'sent'}
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-[var(--text)]">
            {o.body}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={campaign.status === 'sent'}
              rows={10}
              className="mt-1 w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm leading-relaxed"
            />
          </label>
        </>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {campaign?.status !== 'sent' && (
          <>
            <Button variant="outline" onClick={rediscover} disabled={saving}>
              {saving ? t.common.loading : o.rediscover}
            </Button>
            <Button variant="outline" onClick={saveDraft} disabled={saving || !subject || !body}>
              {saving ? t.common.loading : o.saveDraft}
            </Button>
            <Button
              onClick={approveAndSend}
              disabled={sending || !subject || !body || campaign?.status === 'discovering'}
            >
              {sending ? o.sending : o.approveSend}
            </Button>
          </>
        )}
        {campaign?.status === 'sent' && (
          <p className="text-sm text-[var(--accent)]">{o.sentSuccess}</p>
        )}
        {!campaign && packStatus === 'submitted' && (
          <Button variant="outline" onClick={rediscover} disabled={saving}>
            {o.startOutreach}
          </Button>
        )}
      </div>
    </div>
  )
}
