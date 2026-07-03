'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button, cn } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'

interface NewsHeadline {
  title: string
  url: string
  source: string
  snippet?: string
}

interface DayEvent {
  title: string
  at: string
  allDay?: boolean
  account?: string | null
}

interface DayTodo {
  title: string
  done: boolean
}

interface Issue {
  id: string
  issue_date: string
  title: string
  content_md: string
  sections?: {
    greeting?: string
    headlines?: NewsHeadline[]
    todayEvents?: DayEvent[]
    todayTodos?: DayTodo[]
    jobPulse?: string
    closing?: string
  }
}

export function NewsletterView() {
  const { t, locale } = useLocale()
  const nl = t.newsletter
  const mod = getModuleById('newsletter')!

  const [interests, setInterests] = useState('')
  const [newsFeeds, setNewsFeeds] = useState('')
  const [todayIssue, setTodayIssue] = useState<Issue | null>(null)
  const [history, setHistory] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/modules/newsletter')
    const data = await res.json()
    if (data.warning === 'newsletter_table_missing') setWarning(nl.warnings.tableMissing)
    if (res.ok) {
      setInterests((data.settings?.interests ?? []).join(', '))
      setNewsFeeds((data.settings?.news_feeds ?? []).join('\n'))
      setTodayIssue(data.todayIssue)
      setHistory(data.history ?? [])
    }
    setLoading(false)
  }, [nl.warnings.tableMissing])

  useEffect(() => {
    load()
  }, [load])

  async function saveSettings() {
    setSaving(true)
    await fetch('/api/modules/newsletter/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
        news_feeds: newsFeeds.split('\n').map((s) => s.trim()).filter(Boolean),
      }),
    })
    setSaving(false)
  }

  async function generate() {
    setGenerating(true)
    setError(null)
    const res = await fetch('/api/modules/newsletter/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    })
    const data = await res.json()
    setGenerating(false)

    if (!res.ok) {
      setError(data.error ?? nl.errors.generateFailed)
      return
    }
    if (data.warning === 'newsletter_table_missing') {
      setWarning(nl.warnings.tableMissing)
      if (data.preview) {
        setTodayIssue({
          id: 'preview',
          issue_date: new Date().toISOString().slice(0, 10),
          title: data.preview.title,
          content_md: data.preview.contentMd,
          sections: data.preview.sections,
        })
      }
      return
    }
    if (data.issue) {
      setTodayIssue(data.issue)
      await load()
    }
  }

  const issue = todayIssue
  const sections = issue?.sections

  return (
    <ShellLayout>
      <div className="mb-6 flex items-center gap-4">
        <ModuleGlyph
          moduleId="newsletter"
          primary={mod.accent.primary}
          glow={mod.accent.glow}
          size={72}
        />
        <div>
          <Link href="/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]">
            {t.common.backToDashboard}
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{nl.title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{nl.subtitle}</p>
        </div>
      </div>

      {warning && (
        <p className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {warning}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <GlassPanel className="h-fit space-y-4 p-6">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">{nl.interestsTitle}</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{nl.interestsHint}</p>
            <textarea
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">{nl.newsFeedsTitle}</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{nl.newsFeedsHint}</p>
            <textarea
              value={newsFeeds}
              onChange={(e) => setNewsFeeds(e.target.value)}
              rows={4}
              placeholder="https://example.com/feed.xml"
              className="mt-2 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </div>
          <Button variant="outline" onClick={saveSettings} disabled={saving}>
            {saving ? t.common.loading : nl.saveInterests}
          </Button>
          <Button onClick={generate} disabled={generating}>
            {generating ? nl.generating : nl.generateToday}
          </Button>
          <p className="text-xs text-[var(--text-muted)]">{nl.aiNote}</p>
        </GlassPanel>

        <GlassPanel className="p-6">
          {loading ?
            <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
          : issue ?
            <article className="max-w-none">
              <h2 className="text-xl font-semibold text-[var(--text)]">{issue.title}</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {new Date(issue.issue_date + 'T12:00:00').toLocaleDateString(locale, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              {sections?.greeting && (
                <p className="mt-4 text-sm text-[var(--text)]">{sections.greeting}</p>
              )}

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[var(--accent)]">{nl.sections.headlines}</h3>
                {sections?.headlines?.length ?
                  <ul className="mt-2 space-y-3">
                    {sections.headlines.map((h) => (
                      <li key={h.url} className="text-sm">
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[var(--text)] hover:text-[var(--accent)]"
                        >
                          {h.title}
                        </a>
                        <span className="text-xs text-[var(--text-muted)]"> — {h.source}</span>
                        {h.snippet && (
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{h.snippet}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                : <p className="mt-2 text-sm text-[var(--text-muted)]">{nl.noHeadlines}</p>}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[var(--accent)]">{nl.sections.events}</h3>
                {sections?.todayEvents?.length ?
                  <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                    {sections.todayEvents.map((e, i) => (
                      <li key={`${e.title}-${i}`}>
                        {e.allDay ?
                          'All day'
                        : new Date(e.at).toLocaleTimeString(locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                        · {e.title}
                        {e.account ? ` (${e.account})` : ''}
                      </li>
                    ))}
                  </ul>
                : <p className="mt-2 text-sm text-[var(--text-muted)]">{nl.noEvents}</p>}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[var(--accent)]">{nl.sections.todos}</h3>
                {sections?.todayTodos?.length ?
                  <ul className="mt-2 space-y-1">
                    {sections.todayTodos.map((td, i) => (
                      <li key={`${td.title}-${i}`} className="flex items-center gap-2 text-sm">
                        <span
                          className={cn(
                            'inline-block h-4 w-4 rounded border border-[var(--surface-border)] text-center text-[10px] leading-4',
                            td.done && 'bg-[var(--accent)] text-white',
                          )}
                        >
                          {td.done ? '✓' : ''}
                        </span>
                        <span
                          className={td.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}
                        >
                          {td.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                : <p className="mt-2 text-sm text-[var(--text-muted)]">{nl.noTodos}</p>}
              </div>

              {sections?.jobPulse && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-[var(--accent)]">{nl.sections.job}</h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{sections.jobPulse}</p>
                </div>
              )}

              {sections?.closing && (
                <p className="mt-6 text-sm italic text-[var(--text-muted)]">{sections.closing}</p>
              )}
            </article>
          : <p className="text-sm text-[var(--text-muted)]">{nl.empty}</p>}

          {history.length > 1 && (
            <div className="mt-8 border-t border-[var(--surface-border)] pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {nl.history}
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                {history
                  .filter((h) => h.id !== issue?.id)
                  .map((h) => (
                    <li key={h.id}>
                      {h.issue_date} — {h.title}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </GlassPanel>
      </div>
    </ShellLayout>
  )
}
