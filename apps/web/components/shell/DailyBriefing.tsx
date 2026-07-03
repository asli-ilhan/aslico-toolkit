'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from './LocaleProvider'

interface BriefItem {
  id: string
  company: string
  role: string
  deadline_at?: string
  follow_up_at?: string
}

interface CalEvent {
  id: string
  title: string
  starts_at: string
  all_day: boolean
}

interface NewsletterPreview {
  id: string
  title: string
  sections?: { greeting?: string; focus?: string[] }
}

export function DailyBriefing() {
  const { t, locale } = useLocale()
  const b = t.brief
  const [pendingCount, setPendingCount] = useState(0)
  const [deadlines, setDeadlines] = useState<BriefItem[]>([])
  const [followUps, setFollowUps] = useState<BriefItem[]>([])
  const [todayEvents, setTodayEvents] = useState<CalEvent[]>([])
  const [weekEvents, setWeekEvents] = useState<CalEvent[]>([])
  const [newsletter, setNewsletter] = useState<NewsletterPreview | null>(null)
  const [generating, setGenerating] = useState(false)

  function load() {
    fetch('/api/brief')
      .then((r) => r.json())
      .then((data) => {
        if (data.pendingCount != null) setPendingCount(data.pendingCount)
        setDeadlines(data.deadlines ?? [])
        setFollowUps(data.followUps ?? [])
        setTodayEvents(data.todayEvents ?? [])
        setWeekEvents(data.weekEvents ?? [])
        setNewsletter(data.newsletter ?? null)
      })
      .catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  async function generateNewsletter() {
    setGenerating(true)
    const res = await fetch('/api/modules/newsletter/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    })
    setGenerating(false)
    if (res.ok) load()
  }

  const hasReminders =
    pendingCount > 0 ||
    deadlines.length > 0 ||
    followUps.length > 0 ||
    todayEvents.length > 0 ||
    weekEvents.length > 0 ||
    newsletter

  return (
    <GlassPanel className="p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl text-[var(--accent)]" aria-hidden>
            ✦
          </span>
          <h2 className="text-lg font-semibold text-[var(--text)]">{b.title}</h2>
        </div>
        <div className="flex gap-3 text-xs">
          <Link href="/newsletter" className="text-[var(--accent)] hover:underline">
            {b.openNewsletter}
          </Link>
          <Link href="/calendar" className="text-[var(--accent)] hover:underline">
            {b.openCalendar}
          </Link>
          <Link href="/job-agent" className="text-[var(--accent)] hover:underline">
            {b.openJobAgent}
          </Link>
        </div>
      </div>

      <p className="mt-2 text-sm text-[var(--text-muted)]">{b.description}</p>

      {newsletter ?
        <p className="mt-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
          {b.newsletterReady}{' '}
          <span className="text-[var(--text-muted)]">— {newsletter.title}</span>
        </p>
      : <div className="mt-3">
          <Button variant="outline" onClick={generateNewsletter} disabled={generating}>
            {generating ? '…' : b.generateNewsletter}
          </Button>
        </div>
      }

      {hasReminders ?
        <div className="mt-4 space-y-3">
          {pendingCount > 0 && (
            <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
              {b.pendingInbox.replace('{count}', String(pendingCount))}
            </p>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              {b.todayCalendar}
            </p>
            {todayEvents.length > 0 ?
              <ul className="mt-1 space-y-1 text-sm text-[var(--text-muted)]">
                {todayEvents.map((e) => (
                  <li key={e.id}>
                    {e.title}
                    {!e.all_day &&
                      ` (${new Date(e.starts_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })})`}
                  </li>
                ))}
              </ul>
            : <p className="mt-1 text-sm text-[var(--text-muted)]">{b.noEventsToday}</p>}
          </div>

          {weekEvents.length > todayEvents.length && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                {b.weekAhead}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-[var(--text-muted)]">
                {weekEvents.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    {new Date(e.starts_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                    · {e.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {deadlines.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                {b.deadlines}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-[var(--text-muted)]">
                {deadlines.map((d) => (
                  <li key={d.id}>
                    {d.company} · {d.role} ({new Date(d.deadline_at!).toLocaleDateString(locale)})
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
                    {d.company} · {d.role} ({new Date(d.follow_up_at!).toLocaleDateString(locale)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      : !newsletter && (
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
