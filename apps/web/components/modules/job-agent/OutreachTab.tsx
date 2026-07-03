'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { GlassPanel } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { OutreachPanel } from './OutreachPanel'

interface OutreachItem {
  id: string
  pack_id: string
  status: string
  subject: string | null
  application_packs: { company: string; role: string } | null
}

interface OutreachTabProps {
  onWarning: (msg: string | null) => void
}

export function OutreachTab({ onWarning }: OutreachTabProps) {
  const { t } = useLocale()
  const o = t.jobAgent.outreach
  const [items, setItems] = useState<OutreachItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)

  const selected = items.find((i) => i.pack_id === selectedId) ?? null

  const load = useCallback(async () => {
    onWarning(null)
    const [listRes, gmailRes] = await Promise.all([
      fetch('/api/modules/job-agent/outreach'),
      fetch('/api/modules/job-agent/gmail'),
    ])
    const data = await listRes.json()
    const gmailData = await gmailRes.json()

    if (data.warning === 'job_agent_v4_missing') onWarning(t.jobAgent.warnings.v4Missing)
    setItems(data.items ?? [])
    setSelectedId(data.items?.[0]?.pack_id ?? null)
    setGmailConnected(Boolean(gmailData.connected))
    setGmailEmail(gmailData.email ?? null)
  }, [onWarning, t.jobAgent.warnings.v4Missing])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <GlassPanel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-[var(--text)]">{o.tabHint}</p>
          {gmailConnected ? (
            <p className="mt-1 text-xs text-[var(--accent)]">
              {o.sendingFrom}: {gmailEmail}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--text-muted)]">{o.gmailDisconnected}</p>
          )}
        </div>
        <a
          href="/api/auth/gmail/connect"
          className="text-sm font-medium text-[var(--accent)] hover:underline"
        >
          {gmailConnected ? o.reconnectGmail : o.connectGmail}
        </a>
      </GlassPanel>

      {items.length === 0 ? (
        <GlassPanel className="p-6">
          <p className="text-sm text-[var(--text-muted)]">{o.empty}</p>
          <Link href="/modules/job-agent" className="mt-2 inline-block text-sm text-[var(--accent)] hover:underline">
            {o.goHistory}
          </Link>
        </GlassPanel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <GlassPanel className="p-4 lg:col-span-1">
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.pack_id)}
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--surface-border)] px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
                  >
                    <span className="text-[var(--text)]">
                      {item.application_packs?.company} · {item.application_packs?.role}
                    </span>
                    <span className="text-[10px] uppercase text-[var(--accent)]">{item.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </GlassPanel>
          {selected && (
            <GlassPanel className="p-6 lg:col-span-2">
              <OutreachPanel packId={selected.pack_id} packStatus="submitted" />
            </GlassPanel>
          )}
        </div>
      )}
    </div>
  )
}
