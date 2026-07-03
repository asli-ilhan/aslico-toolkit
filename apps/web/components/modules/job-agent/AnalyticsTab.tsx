'use client'

import { useCallback, useEffect, useState } from 'react'
import { GlassPanel } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'

interface AnalyticsTabProps {
  onWarning: (msg: string | null) => void
}

interface AnalyticsData {
  totals: {
    total: number
    submitted: number
    interviews: number
    offers: number
    rejected: number
    pending: number
    avgFit: number
  }
  conversion: { submitRate: number; interviewRate: number; offerRate: number }
  upcomingDeadlines: { id: string; company: string; role: string; deadline_at: string }[]
  followUps: { id: string; company: string; role: string; follow_up_at: string }[]
}

export function AnalyticsTab({ onWarning }: AnalyticsTabProps) {
  const { t } = useLocale()
  const ja = t.jobAgent
  const [data, setData] = useState<AnalyticsData | null>(null)

  const load = useCallback(async () => {
    onWarning(null)
    const res = await fetch('/api/modules/job-agent/analytics')
    const json = await res.json()
    if (!res.ok) onWarning(ja.warnings.v3Missing)
    setData(json)
  }, [ja.warnings.v3Missing, onWarning])

  useEffect(() => {
    load()
  }, [load])

  if (!data?.totals?.total) {
    return (
      <GlassPanel className="p-6">
        <p className="text-sm text-[var(--text-muted)]">{ja.analytics.empty}</p>
      </GlassPanel>
    )
  }

  const cards = [
    { label: ja.analytics.total, value: data.totals.total },
    { label: ja.analytics.submitted, value: data.totals.submitted },
    { label: ja.analytics.interviews, value: data.totals.interviews },
    { label: ja.analytics.offers, value: data.totals.offers },
    { label: ja.analytics.pending, value: data.totals.pending },
    { label: ja.analytics.avgFit, value: `${data.totals.avgFit}%` },
  ]

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <h2 className="text-sm font-semibold text-[var(--text)]">{ja.analytics.title}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-3 text-center"
            >
              <p className="text-2xl font-bold text-[var(--accent)]">{c.value}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{c.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          {ja.analytics.conversion}: {data.conversion.submitRate}% · {data.conversion.interviewRate}% ·{' '}
          {data.conversion.offerRate}%
        </p>
      </GlassPanel>

      {(data.upcomingDeadlines?.length > 0 || data.followUps?.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.upcomingDeadlines?.length > 0 && (
            <GlassPanel className="p-4">
              <h3 className="text-sm font-medium text-[var(--text)]">{ja.analytics.deadlines}</h3>
              <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                {data.upcomingDeadlines.map((d) => (
                  <li key={d.id}>
                    {d.company} · {d.role} ({new Date(d.deadline_at).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            </GlassPanel>
          )}
          {data.followUps?.length > 0 && (
            <GlassPanel className="p-4">
              <h3 className="text-sm font-medium text-[var(--text)]">{ja.analytics.followUps}</h3>
              <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                {data.followUps.map((d) => (
                  <li key={d.id}>
                    {d.company} · {d.role} ({new Date(d.follow_up_at).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            </GlassPanel>
          )}
        </div>
      )}
    </div>
  )
}
