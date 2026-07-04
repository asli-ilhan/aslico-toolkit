'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'
import { useFundingScan } from '@/lib/funding-scout/use-funding-scan'
import { DEFAULT_FUNDING_SETTINGS } from '@/lib/funding-scout/types'

interface FundingApp {
  id: string
  funder: string
  title: string
  funding_type: string
  region: string
  opportunity_url: string | null
  fit_score: number | null
  motivation_letter: string | null
  research_summary: string | null
  project_outline: string | null
  status: string
  deadline: string | null
}

const REGIONS = ['uk', 'eu', 'turkey', 'china', 'japan', 'korea', 'gulf', 'americas', 'australia', 'global'] as const

export function FundingScoutView() {
  const { t } = useLocale()
  const fs = t.fundingScout
  const mod = getModuleById('funding-scout')!
  const { running, stopped, log, summary, runScan, stopScan } = useFundingScan()

  const [items, setItems] = useState<FundingApp[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [regions, setRegions] = useState<string[]>([...DEFAULT_FUNDING_SETTINGS.regions])
  const [scanDepth, setScanDepth] = useState<'normal' | 'deep'>('normal')
  const [requireFull, setRequireFull] = useState(true)
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null
  const inbox = items.filter((i) => i.status === 'pending_review')

  const load = useCallback(async () => {
    setLoading(true)
    setWarning(null)
    const [listRes, settingsRes] = await Promise.all([
      fetch('/api/modules/funding-scout'),
      fetch('/api/modules/funding-scout/settings'),
    ])
    const listData = await listRes.json()
    const settingsData = await settingsRes.json()
    if (listData.warning === 'funding_scout_table_missing') setWarning(fs.warnings.tableMissing)
    if (listRes.ok) {
      setItems(listData.items ?? [])
      setSelectedId(listData.items?.[0]?.id ?? null)
    }
    if (settingsData.settings) {
      setRegions(settingsData.settings.regions ?? regions)
      setScanDepth(settingsData.settings.scanDepth ?? 'normal')
      setRequireFull(settingsData.settings.requireFullFunding ?? true)
    }
    setLoading(false)
  }, [fs.warnings.tableMissing])

  useEffect(() => { load() }, [load])

  async function saveSettings() {
    setSaving(true)
    await fetch('/api/modules/funding-scout/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: { regions, scanDepth, requireFullFunding: requireFull },
      }),
    })
    setSaving(false)
  }

  async function handleScan() {
    setWarning(null)
    await saveSettings()
    const { data, aborted } = await runScan()
    if (!aborted && data?.warning === 'funding_scout_table_missing') setWarning(fs.warnings.tableMissing)
    if (!aborted) load()
  }

  async function patchItem(id: string, patch: Record<string, string>) {
    await fetch(`/api/modules/funding-scout/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    load()
  }

  const fieldClass = 'mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm'

  if (loading) {
    return (
      <ShellLayout>
        <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
      </ShellLayout>
    )
  }

  return (
    <ShellLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)]">
            {t.common.backToDashboard}
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <ModuleGlyph moduleId="funding-scout" primary={mod.accent.primary} glow={mod.accent.glow} size={72} />
            <div>
              <h1 className="text-2xl font-bold text-[var(--text)]">{t.modules['funding-scout'].name}</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{fs.subtitle}</p>
            </div>
          </div>
        </div>

        {warning && (
          <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-sm">{warning}</p>
        )}

        <GlassPanel className="space-y-4 p-6">
          <h2 className="text-sm font-semibold text-[var(--text)]">{fs.scanTitle}</h2>
          <p className="text-xs text-[var(--text-muted)]">{fs.scanHint}</p>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => (
              <label key={r} className="flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={regions.includes(r)}
                  onChange={(e) => {
                    setRegions((prev) => e.target.checked ? [...prev, r] : prev.filter((x) => x !== r))
                  }}
                />
                {r}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              {fs.scanDepth}
              <select value={scanDepth} onChange={(e) => setScanDepth(e.target.value as 'normal' | 'deep')} className={fieldClass}>
                <option value="normal">{fs.scanDepthNormal}</option>
                <option value="deep">{fs.scanDepthDeep}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input type="checkbox" checked={requireFull} onChange={(e) => setRequireFull(e.target.checked)} />
              {fs.requireFullFunding}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleScan} disabled={running}>{running ? fs.scanning : fs.startScan}</Button>
            {running && <Button variant="outline" onClick={stopScan}>{fs.stopScan}</Button>}
            <Button variant="outline" onClick={saveSettings} disabled={saving}>{saving ? t.common.loading : fs.saveSettings}</Button>
          </div>
          {stopped && <p className="text-xs text-[var(--text-muted)]">{fs.stopped}</p>}
          {summary && (
            <p className="text-sm text-[var(--accent)]">
              {fs.scanSummary.replace('{scanned}', String(summary.scanned)).replace('{created}', String(summary.created))}
            </p>
          )}
          {log && (
            <pre className="max-h-40 overflow-auto rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-3 text-xs text-[var(--text-muted)]">{log}</pre>
          )}
        </GlassPanel>

        <div className="grid gap-6 lg:grid-cols-3">
          <GlassPanel className="p-4 lg:col-span-1">
            <h2 className="mb-3 text-sm font-semibold">{fs.inbox} ({inbox.length})</h2>
            {inbox.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">{fs.inboxEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {inbox.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className="w-full rounded-xl border border-[var(--surface-border)] px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
                    >
                      <div className="font-medium text-[var(--text)]">{item.funder}</div>
                      <div className="text-xs text-[var(--text-muted)]">{item.title}</div>
                      {item.fit_score != null && <div className="text-xs text-[var(--accent)]">{fs.fit}: {item.fit_score}%</div>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>

          {selected && (
            <GlassPanel className="space-y-4 p-6 lg:col-span-2">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">{selected.funder}</h2>
                <p className="text-sm text-[var(--text-muted)]">{selected.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{selected.region} · {selected.funding_type}</p>
                {selected.opportunity_url && (
                  <a href={selected.opportunity_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] hover:underline">
                    {fs.openLink}
                  </a>
                )}
              </div>
              {selected.motivation_letter && (
                <div>
                  <h3 className="text-sm font-medium">{fs.motivation}</h3>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-muted)]">{selected.motivation_letter}</pre>
                </div>
              )}
              {selected.research_summary && (
                <div>
                  <h3 className="text-sm font-medium">{fs.researchSummary}</h3>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-muted)]">{selected.research_summary}</pre>
                </div>
              )}
              {selected.project_outline && (
                <div>
                  <h3 className="text-sm font-medium">{fs.projectOutline}</h3>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-muted)]">{selected.project_outline}</pre>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => patchItem(selected.id, { status: 'approved' })}>{fs.approve}</Button>
                <Button variant="outline" onClick={() => patchItem(selected.id, { status: 'submitted' })}>{fs.markSubmitted}</Button>
                <Button variant="outline" onClick={() => patchItem(selected.id, { status: 'skipped' })}>{fs.skip}</Button>
              </div>
            </GlassPanel>
          )}
        </div>

        <p className="text-xs text-[var(--text-muted)]">{fs.profileHint}</p>
      </div>
    </ShellLayout>
  )
}
