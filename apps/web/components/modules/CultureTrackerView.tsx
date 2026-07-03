'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'

interface ScoutSections {
  greeting?: string
  cities?: Array<{
    city: string
    visitFrom?: string
    visitTo?: string
    events?: Array<{ title: string; url: string; source: string; kind: string; snippet?: string }>
    highlights?: string[]
  }>
  mustReadBooks?: Array<{
    title: string
    author: string
    language: string
    category: string
    why: string
    priority: string
  }>
  spotifyNote?: string
  closing?: string
}

interface Scout {
  id: string
  scout_date: string
  title: string
  sections?: ScoutSections
}

interface BookRow {
  id: string
  title: string
  author: string | null
  language: string
  category: string
  status: string
}

export function CultureTrackerView() {
  const { t, locale } = useLocale()
  const ct = t.cultureTracker
  const mod = getModuleById('culture-tracker')!

  const [homeCities, setHomeCities] = useState('London, Istanbul')
  const [interests, setInterests] = useState('')
  const [spotifyArtists, setSpotifyArtists] = useState('')
  const [favoriteAuthors, setFavoriteAuthors] = useState('')
  const [bookTopics, setBookTopics] = useState('business, psychology, development, maritime, philosophy')
  const [languages, setLanguages] = useState('en, tr, fr, es, ar')
  const [todayScout, setTodayScout] = useState<Scout | null>(null)
  const [books, setBooks] = useState<BookRow[]>([])
  const [newBookTitle, setNewBookTitle] = useState('')
  const [newBookAuthor, setNewBookAuthor] = useState('')
  const [loading, setLoading] = useState(true)
  const [scouting, setScouting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/modules/culture-tracker')
    const data = await res.json()
    if (data.warning === 'culture_tracker_table_missing') {
      setWarning(ct.warnings.tableMissing)
    }
    if (res.ok && data.settings) {
      setHomeCities((data.settings.homeCities ?? []).join(', '))
      setInterests((data.settings.interests ?? []).join(', '))
      setSpotifyArtists((data.settings.spotifyArtists ?? []).join(', '))
      setFavoriteAuthors((data.settings.favoriteAuthors ?? []).join(', '))
      setBookTopics((data.settings.bookTopics ?? []).join(', '))
      setLanguages((data.settings.languages ?? []).join(', '))
      setTodayScout(data.todayScout)
      setBooks(data.books ?? [])
    }
    setLoading(false)
  }, [ct.warnings.tableMissing])

  useEffect(() => {
    load()
  }, [load])

  async function saveSettings() {
    setSaving(true)
    await fetch('/api/modules/culture-tracker/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        home_cities: splitCsv(homeCities),
        interests: splitCsv(interests),
        spotify_artists: splitCsv(spotifyArtists),
        favorite_authors: splitCsv(favoriteAuthors),
        book_topics: splitCsv(bookTopics),
        languages: splitCsv(languages).map((l) => l.replace(/\s/g, '')),
      }),
    })
    setSaving(false)
    await load()
  }

  async function addBook() {
    if (!newBookTitle.trim()) return
    const res = await fetch('/api/modules/culture-tracker/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newBookTitle, author: newBookAuthor }),
    })
    if (res.ok) {
      setNewBookTitle('')
      setNewBookAuthor('')
      await load()
    }
  }

  async function updateBookStatus(id: string, status: string) {
    await fetch(`/api/modules/culture-tracker/books/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  async function removeBook(id: string) {
    await fetch(`/api/modules/culture-tracker/books/${id}`, { method: 'DELETE' })
    await load()
  }

  async function runScout() {
    setScouting(true)
    setError(null)
    const res = await fetch('/api/modules/culture-tracker/scout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    })
    const data = await res.json()
    setScouting(false)
    if (!res.ok) {
      setError(data.error ?? ct.errors.scoutFailed)
      return
    }
    if (data.warning === 'culture_tracker_table_missing') {
      setWarning(ct.warnings.tableMissing)
      if (data.preview) {
        setTodayScout({
          id: 'preview',
          scout_date: new Date().toISOString().slice(0, 10),
          title: data.preview.title,
          sections: data.preview.sections,
        })
      }
      return
    }
    if (data.scout) {
      setTodayScout(data.scout)
    }
  }

  const sections = todayScout?.sections

  return (
    <ShellLayout>
      <div className="mb-6 flex items-center gap-4">
        <ModuleGlyph
          moduleId="culture-tracker"
          primary={mod.accent.primary}
          glow={mod.accent.glow}
          size={72}
        />
        <div>
          <Link href="/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]">
            {t.common.backToDashboard}
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{ct.title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{ct.subtitle}</p>
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

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <GlassPanel className="h-fit space-y-4 p-6">
          <h2 className="text-sm font-semibold text-[var(--text)]">{ct.settingsTitle}</h2>
          <label className="block text-xs text-[var(--text-muted)]">
            {ct.homeCities}
            <input
              value={homeCities}
              onChange={(e) => setHomeCities(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            {ct.interests}
            <textarea
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            {ct.spotifyArtists}
            <input
              value={spotifyArtists}
              onChange={(e) => setSpotifyArtists(e.target.value)}
              placeholder="e.g. Khruangbin, Nils Frahm"
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            {ct.favoriteAuthors}
            <input
              value={favoriteAuthors}
              onChange={(e) => setFavoriteAuthors(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            {ct.bookTopics}
            <input
              value={bookTopics}
              onChange={(e) => setBookTopics(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            {ct.languages}
            <input
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <Button variant="outline" className="w-full" disabled={saving} onClick={saveSettings}>
            {saving ? t.common.loading : ct.saveSettings}
          </Button>
          <Button className="w-full" disabled={scouting} onClick={runScout}>
            {scouting ? ct.scouting : ct.runScout}
          </Button>
          <p className="text-xs text-[var(--text-muted)]">{ct.calendarHint}</p>
        </GlassPanel>

        <GlassPanel className="p-6">
          {loading ?
            <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
          : todayScout ?
            <article className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text)]">{todayScout.title}</h2>
                {sections?.greeting && (
                  <p className="mt-2 text-sm text-[var(--text)]">{sections.greeting}</p>
                )}
              </div>

              {sections?.cities?.map((c) => (
                <div key={c.city}>
                  <h3 className="text-sm font-semibold text-[var(--accent)]">
                    {c.city}
                    {c.visitFrom && c.visitTo ?
                      <span className="font-normal text-[var(--text-muted)]">
                        {' '}
                        · {c.visitFrom} → {c.visitTo}
                      </span>
                    : null}
                  </h3>
                  {c.events?.length ?
                    <ul className="mt-2 space-y-2">
                      {c.events.map((e) => (
                        <li key={e.url} className="text-sm">
                          <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--accent)]">
                            {e.kind}
                          </span>{' '}
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:text-[var(--accent)]"
                          >
                            {e.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  : <p className="mt-1 text-xs text-[var(--text-muted)]">{ct.noEvents}</p>}
                </div>
              ))}

              {sections?.mustReadBooks && sections.mustReadBooks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--accent)]">{ct.booksTitle}</h3>
                  <ul className="mt-2 space-y-2">
                    {sections.mustReadBooks.map((b) => (
                      <li key={`${b.title}-${b.author}`} className="text-sm">
                        <span className="font-medium text-[var(--text)]">{b.title}</span>
                        <span className="text-[var(--text-muted)]"> — {b.author}</span>
                        <span className="text-xs text-[var(--accent)]">
                          {' '}
                          [{b.language} · {b.category}]
                          {b.priority === 'must' ? ' ★' : ''}
                        </span>
                        <p className="text-xs text-[var(--text-muted)]">{b.why}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sections?.spotifyNote && (
                <p className="text-sm text-[var(--text-muted)]">{sections.spotifyNote}</p>
              )}
              {sections?.closing && (
                <p className="text-sm italic text-[var(--text-muted)]">{sections.closing}</p>
              )}
            </article>
          : <p className="text-sm text-[var(--text-muted)]">{ct.empty}</p>}

          {books.length > 0 && (
            <div className="mt-8 border-t border-[var(--surface-border)] pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {ct.yourBooks}
              </h3>
              <ul className="mt-2 space-y-2 text-sm">
                {books.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-[var(--text-muted)]">
                      {b.title}
                      {b.author ? ` — ${b.author}` : ''}
                    </span>
                    <select
                      value={b.status}
                      onChange={(e) => updateBookStatus(b.id, e.target.value)}
                      className="rounded border border-[var(--surface-border)] bg-transparent px-1.5 py-0.5 text-xs"
                    >
                      {Object.entries(ct.statuses).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeBook(b.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      {ct.removeBook}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--surface-border)] pt-4">
            <input
              value={newBookTitle}
              onChange={(e) => setNewBookTitle(e.target.value)}
              placeholder={ct.bookTitle}
              className="flex-1 rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
            <input
              value={newBookAuthor}
              onChange={(e) => setNewBookAuthor(e.target.value)}
              placeholder={ct.bookAuthor}
              className="flex-1 rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
            <Button variant="outline" onClick={addBook}>
              {ct.addBook}
            </Button>
          </div>
        </GlassPanel>
      </div>
    </ShellLayout>
  )
}

function splitCsv(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}
