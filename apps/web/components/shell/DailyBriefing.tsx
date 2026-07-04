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

interface CulturePreview {
  id: string
  title: string
}

interface LanguagePreview {
  isRestDay: boolean
  languageLabel: string | null
  topic: string | null
  status: string | null
  programDay: number
}

interface TodoItem {
  id: string
  title: string
  done: boolean
}

interface TripPreview {
  id: string
  destination: string
  start_date: string
  end_date: string | null
}

interface FundingDeadline {
  id: string
  funder: string
  title: string
  deadline: string
}

export function DailyBriefing() {
  const { t, locale } = useLocale()
  const b = t.brief
  const [pendingCount, setPendingCount] = useState(0)
  const [fundingPendingCount, setFundingPendingCount] = useState(0)
  const [fundingDeadlines, setFundingDeadlines] = useState<FundingDeadline[]>([])
  const [deadlines, setDeadlines] = useState<BriefItem[]>([])
  const [followUps, setFollowUps] = useState<BriefItem[]>([])
  const [todayEvents, setTodayEvents] = useState<CalEvent[]>([])
  const [weekEvents, setWeekEvents] = useState<CalEvent[]>([])
  const [newsletter, setNewsletter] = useState<NewsletterPreview | null>(null)
  const [cultureScout, setCultureScout] = useState<CulturePreview | null>(null)
  const [languageTutor, setLanguageTutor] = useState<LanguagePreview | null>(null)
  const [todayTodos, setTodayTodos] = useState<TodoItem[]>([])
  const [upcomingTrip, setUpcomingTrip] = useState<TripPreview | null>(null)
  const [interests, setInterests] = useState<string[] | null>(null)
  const [generating, setGenerating] = useState(false)

  function load() {
    fetch('/api/brief')
      .then((r) => r.json())
      .then((data) => {
        if (data.pendingCount != null) setPendingCount(data.pendingCount)
        if (data.fundingPendingCount != null) setFundingPendingCount(data.fundingPendingCount)
        setFundingDeadlines(data.fundingDeadlines ?? [])
        setDeadlines(data.deadlines ?? [])
        setFollowUps(data.followUps ?? [])
        setTodayEvents(data.todayEvents ?? [])
        setWeekEvents(data.weekEvents ?? [])
        setNewsletter(data.newsletter ?? null)
        setCultureScout(data.cultureScout ?? null)
        setLanguageTutor(data.languageTutor ?? null)
        setTodayTodos(data.todayTodos ?? [])
        setUpcomingTrip(data.upcomingTrip ?? null)
        setInterests(data.interests ?? null)
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
    fundingPendingCount > 0 ||
    fundingDeadlines.length > 0 ||
    deadlines.length > 0 ||
    followUps.length > 0 ||
    todayEvents.length > 0 ||
    weekEvents.length > 0 ||
    newsletter ||
    cultureScout ||
    languageTutor ||
    todayTodos.length > 0 ||
    upcomingTrip

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
          <Link href="/language-tutor" className="text-[var(--accent)] hover:underline">
            {b.openLanguageTutor}
          </Link>
          <Link href="/culture-tracker" className="text-[var(--accent)] hover:underline">
            {b.openCultureTracker}
          </Link>
          <Link href="/travel-scout" className="text-[var(--accent)] hover:underline">
            {b.openTravelScout}
          </Link>
          <Link href="/funding-scout" className="text-[var(--accent)] hover:underline">
            {b.openFundingScout}
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
            {generating ? b.generating : b.generateNewsletter}
          </Button>
        </div>
      }

      {languageTutor && (
        <p className="mt-3 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm text-[var(--text-muted)]">
          {languageTutor.isRestDay ?
            b.languageRestDay
          : <>
              {b.languageLessonToday}:{' '}
              <span className="text-[var(--text)]">
                {languageTutor.languageLabel}
                {languageTutor.topic ? ` — ${languageTutor.topic}` : ''}
                {languageTutor.status === 'done' ? ' ✓' : ''}
              </span>
            </>
          }
        </p>
      )}

      {cultureScout && (
        <p className="mt-3 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm text-[var(--text-muted)]">
          {b.cultureScoutReady}{' '}
          <span className="text-[var(--text)]">— {cultureScout.title}</span>
        </p>
      )}

      {upcomingTrip && (
        <p className="mt-3 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm text-[var(--text-muted)]">
          {b.upcomingTrip}:{' '}
          <span className="text-[var(--text)]">
            {upcomingTrip.destination} ({new Date(upcomingTrip.start_date).toLocaleDateString(locale)}
            {upcomingTrip.end_date ?
              ` → ${new Date(upcomingTrip.end_date).toLocaleDateString(locale)}`
            : ''}
            )
          </span>
        </p>
      )}

      {hasReminders ?
        <div className="mt-4 space-y-3">
          {fundingPendingCount > 0 && (
            <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
              {b.fundingPendingInbox.replace('{count}', String(fundingPendingCount))}
            </p>
          )}

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

          {todayTodos.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                {b.todayTodos}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-[var(--text-muted)]">
                {todayTodos.map((todo) => (
                  <li key={todo.id} className={todo.done ? 'line-through opacity-60' : ''}>
                    {todo.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
          {fundingDeadlines.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                {b.fundingDeadlines}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-[var(--text-muted)]">
                {fundingDeadlines.map((d) => (
                  <li key={d.id}>
                    {d.funder} · {d.title} ({new Date(`${d.deadline}T12:00:00`).toLocaleDateString(locale)})
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
        {(interests?.length ? interests : b.tags).map((tag) => (
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
