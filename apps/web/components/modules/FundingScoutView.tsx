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
import { ScoutSkippedPanel, type SessionSkippedItem } from '@/components/scout/ScoutSkippedPanel'
import { useDismissWithFeedback } from '@/lib/scout/use-dismiss-with-feedback'

interface FundingApp {
  id: string
  funder: string
  title: string
  funding_type: string
  region: string
  opportunity_url: string | null
  fit_score: number | null
  fit_reason: string | null
  eligibility_pass: boolean | null
  eligibility_reason: string | null
  eligibility_flags: string[] | null
  motivation_letter: string | null
  research_summary: string | null
  project_outline: string | null
  status: string
  deadline: string | null
  amount: string | null
}

function flagValue(flags: string[] | null | undefined, key: string): string | null {
  const hit = flags?.find((f) => f.startsWith(`${key}:`))
  return hit ? hit.slice(key.length + 1) : null
}

const REGIONS = ['uk', 'eu', 'turkey', 'china', 'japan', 'korea', 'gulf', 'americas', 'australia', 'global'] as const
const PARTNER_COUNTRIES = ['china', 'netherlands', 'uk', 'germany', 'japan', 'usa'] as const
const SUPERVISION_MODELS = ['standard', 'joint_phd', 'co_supervision', 'cotutelle'] as const
const PANEL_SKIPPED_KEY = 'aslico:funding-scout:panel-skipped'

function readPanelSkipped(): SessionSkippedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PANEL_SKIPPED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SessionSkippedItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function FundingScoutView() {
  const { t, locale } = useLocale()
  const fs = t.fundingScout
  const ss = t.scoutSkipped
  const mod = getModuleById('funding-scout')!
  const {
    running,
    stopped,
    log,
    summary,
    sessionSkipped,
    runScan,
    stopScan,
    dismissSessionSkipped,
  } = useFundingScan()
  const { openDismiss, dialog: dismissDialog } = useDismissWithFeedback('funding-scout')

  const [items, setItems] = useState<FundingApp[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [regions, setRegions] = useState<string[]>([...DEFAULT_FUNDING_SETTINGS.regions])
  const [scanDepth, setScanDepth] = useState<'normal' | 'deep'>('normal')
  const [requireFull, setRequireFull] = useState(true)
  const [phdStartMonth, setPhdStartMonth] = useState(DEFAULT_FUNDING_SETTINGS.phdStartMonth)
  const [homeUniversity, setHomeUniversity] = useState('')
  const [homeCountry, setHomeCountry] = useState(DEFAULT_FUNDING_SETTINGS.homeCountry)
  const [partnerCountries, setPartnerCountries] = useState<string[]>([...DEFAULT_FUNDING_SETTINGS.partnerCountries])
  const [supervisionModel, setSupervisionModel] = useState(DEFAULT_FUNDING_SETTINGS.supervisionModel)
  const [partnershipNotes, setPartnershipNotes] = useState('')
  const [strictEligibility, setStrictEligibility] = useState(true)
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deadlineDraft, setDeadlineDraft] = useState('')
  const [skippedRefresh, setSkippedRefresh] = useState(0)
  const [panelSkipped, setPanelSkipped] = useState<SessionSkippedItem[]>([])

  const skippedForPanel = panelSkipped.length > 0 ? panelSkipped : sessionSkipped

  useEffect(() => {
    setPanelSkipped(readPanelSkipped())
  }, [])

  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null
  const selectedConfidence = selected ? flagValue(selected.eligibility_flags, 'confidence') : null
  const selectedApplicantType = selected ? flagValue(selected.eligibility_flags, 'applicant_type') : null
  const selectedVerifyNote = selected?.eligibility_reason?.includes('verify: ')
    ? selected.eligibility_reason.split('verify: ').pop()?.split(' · ')[0]
    : null
  const inbox = [...items.filter((i) => i.status === 'pending_review')].sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
    if (a.deadline) return -1
    if (b.deadline) return 1
    return 0
  })

  useEffect(() => {
    setDeadlineDraft(selected?.deadline?.slice(0, 10) ?? '')
  }, [selected?.id, selected?.deadline])

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
      const s = settingsData.settings
      setRegions(s.regions ?? regions)
      setScanDepth(s.scanDepth ?? 'normal')
      setRequireFull(s.requireFullFunding ?? true)
      setPhdStartMonth(s.phdStartMonth ?? DEFAULT_FUNDING_SETTINGS.phdStartMonth)
      setHomeUniversity(s.homeUniversity ?? '')
      setHomeCountry(s.homeCountry ?? 'TR')
      setPartnerCountries(s.partnerCountries ?? [...DEFAULT_FUNDING_SETTINGS.partnerCountries])
      setSupervisionModel(s.supervisionModel ?? 'co_supervision')
      setPartnershipNotes(s.partnershipNotes ?? '')
      setStrictEligibility(s.strictEligibility !== false)
    }
    setLoading(false)
  }, [fs.warnings.tableMissing])

  const refreshInbox = useCallback(async () => {
    const listRes = await fetch('/api/modules/funding-scout')
    const listData = await listRes.json()
    if (listRes.ok) setItems(listData.items ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  async function saveSettings() {
    setSaving(true)
    await fetch('/api/modules/funding-scout/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          regions,
          scanDepth,
          requireFullFunding: requireFull,
          phdStartMonth,
          homeUniversity,
          homeCountry,
          partnerCountries,
          supervisionModel,
          partnershipNotes,
          strictEligibility,
          citizenship: homeCountry,
          phdStage: 'starting',
        },
      }),
    })
    setSaving(false)
  }

  async function handleScan() {
    setWarning(null)
    await saveSettings()
    const { data, aborted } = await runScan()
    if (!aborted && data) {
      const warnings = [
        ...(Array.isArray(data.warnings) ? data.warnings : []),
        ...(data.warning ? [data.warning] : []),
      ]
      if (warnings.includes('funding_scout_table_missing')) {
        setWarning(fs.warnings.tableMissing)
      } else if (warnings.includes('scout_skipped_table_missing')) {
        setWarning(ss.warnings.tableMissing)
      } else if (warnings.includes('scout_skipped_save_failed')) {
        setWarning(ss.warnings.saveFailed)
      }
      if (Array.isArray(data.skippedPreview)) {
        setPanelSkipped(data.skippedPreview)
        try {
          localStorage.setItem(PANEL_SKIPPED_KEY, JSON.stringify(data.skippedPreview))
        } catch {
          /* quota */
        }
      }
      await refreshInbox()
      setSkippedRefresh((n) => n + 1)
    }
  }

  async function patchItem(id: string, patch: Record<string, string | null>) {
    await fetch(`/api/modules/funding-scout/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await refreshInbox()
  }

  function formatDeadline(date: string) {
    return new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
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
              {fs.scanSummary
                .replace('{scanned}', String(summary.scanned))
                .replace('{created}', String(summary.created))
                .replace('{new}', String(summary.newCandidates ?? 0))
                .replace('{dup}', String(summary.duplicates ?? 0))}
              {(summary.skipped ?? 0) > 0 && (
                <span className="block text-xs text-[var(--text-muted)]">
                  {ss.title}: {summary.skipped} — {ss.hint}
                </span>
              )}
            </p>
          )}
          {log && (
            <pre className="max-h-40 overflow-auto rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-3 text-xs text-[var(--text-muted)]">{log}</pre>
          )}
        </GlassPanel>

        <ScoutSkippedPanel
          key={`skipped-${skippedRefresh}-${skippedForPanel.length}`}
          moduleId="funding-scout"
          refreshKey={skippedRefresh}
          sessionItems={skippedForPanel}
          onPromoted={refreshInbox}
          onSessionDismiss={(id) => {
            dismissSessionSkipped(id)
            setPanelSkipped((prev) => {
              const next = prev.filter((s) => s.id !== id)
              try {
                if (next.length) localStorage.setItem(PANEL_SKIPPED_KEY, JSON.stringify(next))
                else localStorage.removeItem(PANEL_SKIPPED_KEY)
              } catch { /* */ }
              return next
            })
          }}
        />

        <GlassPanel className="space-y-4 p-6">
          <h2 className="text-sm font-semibold text-[var(--text)]">{fs.eligibilityTitle}</h2>
          <p className="text-xs text-[var(--text-muted)]">{fs.eligibilityHint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              {fs.phdStartMonth}
              <input type="month" value={phdStartMonth} onChange={(e) => setPhdStartMonth(e.target.value)} className={fieldClass} />
            </label>
            <label className="block text-sm">
              {fs.homeCountry}
              <input value={homeCountry} onChange={(e) => setHomeCountry(e.target.value.toUpperCase())} placeholder="TR" className={fieldClass} />
            </label>
            <label className="block text-sm sm:col-span-2">
              {fs.homeUniversity}
              <input value={homeUniversity} onChange={(e) => setHomeUniversity(e.target.value)} placeholder="Istanbul Technical University" className={fieldClass} />
            </label>
            <label className="block text-sm">
              {fs.supervisionModel}
              <select value={supervisionModel} onChange={(e) => setSupervisionModel(e.target.value as typeof supervisionModel)} className={fieldClass}>
                {SUPERVISION_MODELS.map((m) => (
                  <option key={m} value={m}>{fs.supervisionModels[m] ?? m}</option>
                ))}
              </select>
            </label>
            <div className="text-sm">
              <span className="block">{fs.partnerCountries}</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {PARTNER_COUNTRIES.map((c) => (
                  <label key={c} className="flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={partnerCountries.includes(c)}
                      onChange={(e) => {
                        setPartnerCountries((prev) => e.target.checked ? [...prev, c] : prev.filter((x) => x !== c))
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <label className="block text-sm sm:col-span-2">
              {fs.partnershipNotes}
              <textarea
                value={partnershipNotes}
                onChange={(e) => setPartnershipNotes(e.target.value)}
                placeholder={fs.partnershipNotesPlaceholder}
                rows={3}
                className={fieldClass}
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={strictEligibility} onChange={(e) => setStrictEligibility(e.target.checked)} />
              {fs.strictEligibility}
            </label>
          </div>
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
                      {item.deadline && (
                        <div className="text-xs font-medium text-[var(--accent)]">
                          {fs.deadline}: {formatDeadline(item.deadline)}
                        </div>
                      )}
                      {item.fit_score != null && <div className="text-xs text-[var(--accent)]">{fs.fit}: {item.fit_score}%</div>}
                      {flagValue(item.eligibility_flags, 'confidence') === 'verified' && (
                        <div className="text-xs text-green-500/90">{fs.confidenceVerified}</div>
                      )}
                      {flagValue(item.eligibility_flags, 'confidence') === 'unverified' && (
                        <div className="text-xs text-amber-500/90">{fs.confidenceUnverified}</div>
                      )}
                      {item.eligibility_pass && item.eligibility_reason && (
                        <div className="text-xs text-green-500/90">{fs.eligible}: {item.eligibility_reason.slice(0, 90)}{item.eligibility_reason.length > 90 ? '…' : ''}</div>
                      )}
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
                {(selectedConfidence || selectedApplicantType || selected.amount) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {selectedConfidence && (
                      <span className={`rounded-lg px-2 py-1 ${selectedConfidence === 'verified' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {fs.confidence}: {selectedConfidence === 'verified' ? fs.confidenceVerified : fs.confidenceUnverified}
                      </span>
                    )}
                    {selectedApplicantType && (
                      <span className="rounded-lg bg-[var(--background-alt)] px-2 py-1 text-[var(--text-muted)]">
                        {fs.applicantType}: {selectedApplicantType.includes('PI-led') ? fs.applicantTypePiLed : fs.applicantTypeStudent}
                      </span>
                    )}
                    {selected.amount && (
                      <span className="rounded-lg bg-[var(--background-alt)] px-2 py-1 text-[var(--text-muted)]">{selected.amount}</span>
                    )}
                  </div>
                )}
                {selectedVerifyNote && (
                  <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-[var(--text)]">
                    <span className="font-medium">{fs.verifyNotes}: </span>
                    {selectedVerifyNote}
                  </p>
                )}
                {selected.eligibility_reason && (
                  <p className="mt-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-[var(--text)]">
                    <span className="font-medium">{fs.eligibilityReason}: </span>
                    {selected.eligibility_reason}
                    {selected.eligibility_flags?.length ? (
                      <span className="mt-1 block text-[var(--text-muted)]">{selected.eligibility_flags.join(' · ')}</span>
                    ) : null}
                  </p>
                )}
                {selected.fit_reason && (
                  <p className="text-xs text-[var(--text-muted)]">{fs.fit}: {selected.fit_reason}</p>
                )}
                <div className="mt-2 space-y-2">
                  <label className="block text-sm">
                    {fs.deadline}
                    <input
                      type="date"
                      value={deadlineDraft}
                      onChange={(e) => setDeadlineDraft(e.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  {!deadlineDraft && <p className="text-xs text-[var(--text-muted)]">{fs.noDeadline}</p>}
                  {deadlineDraft && (
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatDeadline(deadlineDraft)} · {fs.deadlineCalendarHint}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => patchItem(selected.id, { deadline: deadlineDraft || null })}
                  >
                    {fs.saveSettings}
                  </Button>
                </div>
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
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selected) return
                    openDismiss({
                      action: 'skip',
                      title: selected.title,
                      subtitle: selected.funder,
                      itemUrl: selected.opportunity_url,
                      onConfirm: () => patchItem(selected.id, { status: 'skipped' }),
                    })
                  }}
                >
                  {fs.skip}
                </Button>
              </div>
            </GlassPanel>
          )}
        </div>

        <p className="text-xs text-[var(--text-muted)]">{fs.profileHint}</p>
        {dismissDialog}
      </div>
    </ShellLayout>
  )
}
