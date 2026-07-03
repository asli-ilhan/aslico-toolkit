'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'

const VIBES = ['offbeat', 'authentic', 'high-society', 'hidden-gem'] as const

interface Report {
  id: string
  destination: string
  title: string
  sections?: {
    greeting?: string
    dateWindow?: string
    vibeSections?: Array<{
      vibe: string
      label: string
      curatorNote?: string
      picks?: Array<{ title: string; url: string; kind: string; source: string; snippet?: string }>
    }>
    insiderTips?: string[]
    closing?: string
  }
}

export function TravelScoutView() {
  const { t, locale } = useLocale()
  const ts = t.travelScout
  const mod = getModuleById('travel-scout')!

  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [interests, setInterests] = useState('')
  const [vibes, setVibes] = useState<string[]>([...VIBES])
  const [avoidMass, setAvoidMass] = useState(true)
  const [report, setReport] = useState<Report | null>(null)
  const [history, setHistory] = useState<Report[]>([])
  const [plans, setPlans] = useState<
    Array<{ id: string; destination: string; start_date: string; end_date: string | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [scouting, setScouting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/modules/travel-scout')
    const data = await res.json()
    if (data.warning === 'travel_scout_table_missing') setWarning(ts.warnings.tableMissing)
    if (res.ok) {
      if (data.settings) {
        setVibes(data.settings.preferredVibes ?? [...VIBES])
        setInterests((data.settings.interests ?? []).join(', '))
        setAvoidMass(data.settings.avoidMassTourism ?? true)
      }
      const reports = data.reports ?? []
      setHistory(reports)
      setReport(reports[0] ?? null)
      setPlans(data.plans ?? [])
    }
    setLoading(false)
  }, [ts.warnings.tableMissing])

  useEffect(() => {
    load()
  }, [load])

  async function saveSettings() {
    setSaving(true)
    await fetch('/api/modules/travel-scout/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferred_vibes: vibes,
        interests: splitCsv(interests),
        avoid_mass_tourism: avoidMass,
      }),
    })
    setSaving(false)
  }

  async function runScout(mode: 'trip' | 'random') {
    setScouting(true)
    setError(null)
    const res = await fetch('/api/modules/travel-scout/scout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale,
        mode,
        destination: mode === 'trip' ? destination : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    })
    const data = await res.json()
    setScouting(false)
    if (!res.ok) {
      setError(data.error ?? ts.errors.scoutFailed)
      return
    }
    if (data.warning === 'travel_scout_table_missing') {
      setWarning(ts.warnings.tableMissing)
      if (data.preview) {
        setReport({
          id: 'preview',
          destination: data.preview.sections?.destination ?? '?',
          title: data.preview.title,
          sections: data.preview.sections,
        })
      }
      return
    }
    if (data.report) {
      setReport(data.report)
      await load()
    }
  }

  function toggleVibe(v: string) {
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  const sections = report?.sections

  return (
    <ShellLayout>
      <div className="mb-6 flex items-center gap-4">
        <ModuleGlyph moduleId="travel-scout" primary={mod.accent.primary} glow={mod.accent.glow} size={72} />
        <div>
          <Link href="/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]">
            {t.common.backToDashboard}
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{ts.title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{ts.subtitle}</p>
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
          <h2 className="text-sm font-semibold text-[var(--text)]">{ts.planTrip}</h2>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={ts.destinationPlaceholder}
            className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-2 py-2 text-sm"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-2 py-2 text-sm"
            />
          </div>
          <Button className="w-full" disabled={scouting} onClick={() => runScout('trip')}>
            {scouting ? ts.scouting : ts.scoutTrip}
          </Button>
          <Button variant="outline" className="w-full" disabled={scouting} onClick={() => runScout('random')}>
            {ts.randomPick}
          </Button>
          <p className="text-xs text-[var(--text-muted)]">{ts.calendarHint}</p>

          <hr className="border-[var(--surface-border)]" />

          <h2 className="text-sm font-semibold text-[var(--text)]">{ts.vibesTitle}</h2>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggleVibe(v)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  vibes.includes(v) ?
                    'bg-[var(--accent)] text-white'
                  : 'border border-[var(--surface-border)] text-[var(--text-muted)]'
                }`}
              >
                {ts.vibes[v] ?? v}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input type="checkbox" checked={avoidMass} onChange={(e) => setAvoidMass(e.target.checked)} />
            {ts.avoidMass}
          </label>
          <textarea
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder={ts.interestsPlaceholder}
            rows={2}
            className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
          />
          <Button variant="outline" className="w-full" disabled={saving} onClick={saveSettings}>
            {saving ? t.common.loading : ts.saveSettings}
          </Button>
        </GlassPanel>

        <GlassPanel className="p-6">
          {loading ?
            <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
          : report ?
            <article className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text)]">{report.title}</h2>
                {sections?.greeting && <p className="mt-2 text-sm">{sections.greeting}</p>}
                {sections?.dateWindow && (
                  <p className="text-xs text-[var(--accent)]">{sections.dateWindow}</p>
                )}
              </div>

              {sections?.vibeSections?.map((vs) => (
                <div key={vs.vibe}>
                  <h3 className="text-sm font-semibold text-[var(--accent)]">{vs.label}</h3>
                  {vs.curatorNote && (
                    <p className="mt-1 text-xs italic text-[var(--text-muted)]">{vs.curatorNote}</p>
                  )}
                  <ul className="mt-2 space-y-2">
                    {vs.picks?.map((p) => (
                      <li key={p.url} className="text-sm">
                        <span className="text-[10px] uppercase text-[var(--text-muted)]">{p.kind}</span>{' '}
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-[var(--accent)]">
                          {p.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {sections?.insiderTips && sections.insiderTips.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--accent)]">{ts.insiderTips}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[var(--text-muted)]">
                    {sections.insiderTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {sections?.closing && (
                <p className="text-sm italic text-[var(--text-muted)]">{sections.closing}</p>
              )}
            </article>
          : <p className="text-sm text-[var(--text-muted)]">{ts.empty}</p>}

          {history.length > 1 && (
            <div className="mt-8 border-t border-[var(--surface-border)] pt-4">
              <h3 className="text-xs font-medium uppercase text-[var(--text-muted)]">{ts.history}</h3>
              <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                {history.slice(1).map((h) => (
                  <li key={h.id}>
                    {h.destination} — {h.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plans.length > 0 && (
            <div className="mt-8 border-t border-[var(--surface-border)] pt-4">
              <h3 className="text-xs font-medium uppercase text-[var(--text-muted)]">{ts.upcomingPlans}</h3>
              <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                {plans.map((p) => (
                  <li key={p.id}>
                    {p.destination} · {p.start_date}
                    {p.end_date ? ` → ${p.end_date}` : ''}
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

function splitCsv(s: string): string[] {
  return s.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)
}
