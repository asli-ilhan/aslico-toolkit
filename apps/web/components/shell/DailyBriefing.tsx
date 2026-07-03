'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GlassPanel } from '@aslico/ui'
import { useLocale } from './LocaleProvider'

interface BriefItem {
  id: string
  company: string
  role: string
  deadline_at?: string
  follow_up_at?: string
}

export function DailyBriefing() {
  const { t } = useLocale()
  const b = t.brief
  const [pendingCount, setPendingCount] = useState(0)
  const [deadlines, setDeadlines] = useState<BriefItem[]>([])
  const [followUps, setFollowUps] = useState<BriefItem[]>([])

  useEffect(() => {
    fetch('/api/modules/job-agent/brief')
      .then((r) => r.json())
      .then((data) => {
        if (data.pendingCount != null) setPendingCount(data.pendingCount)
        setDeadlines(data.deadlines ?? [])
        setFollowUps(data.followUps ?? [])
      })
      .catch(() => {})
  }, [])

  const hasReminders = pendingCount > 0 || deadlines.length > 0 || followUps.length > 0

  return (
    <GlassPanel className="p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl text-[var(--accent)]" aria-hidden>
            ✦
          </span>
          <h2 className="text-lg font-semibold text-[var(--text)]">{b.title}</h2>
        </div>
        <Link href="/job-agent" className="text-xs text-[var(--accent)] hover:underline">
          {b.openJobAgent}
        </Link>
      </div>

      {hasReminders ? (
        <div className="mt-4 space-y-3">
          {pendingCount > 0 && (
            <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
              {b.pendingInbox.replace('{count}', String(pendingCount))}
            </p>
          )}
          {deadlines.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                {b.deadlines}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-[var(--text-muted)]">
                {deadlines.map((d) => (
                  <li key={d.id}>
                    {d.company} · {d.role} ({new Date(d.deadline_at!).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {followUps.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                {b.followUps}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-[var(--text-muted)]">
                {followUps.map((d) => (
                  <li key={d.id}>
                    {d.company} · {d.role} ({new Date(d.follow_up_at!).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-muted)]">{b.noReminders}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {b.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent)]"
          >
            {tag}
          </span>
        ))}
      </div>
    </GlassPanel>
  )
}
