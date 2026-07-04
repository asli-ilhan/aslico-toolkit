'use client'

import { useCallback, useEffect, useState } from 'react'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { DEFAULT_PREFERENCES } from '@/lib/job-agent/types'

interface PreferencesTabProps {
  onWarning: (msg: string | null) => void
}

interface RunRow {
  id: string
  started_at: string
  finished_at: string | null
  jobs_scanned: number
  packs_created: number
  log: { message: string; level?: string }[] | null
}

function formatWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function PreferencesTab({ onWarning }: PreferencesTabProps) {
  const { t, locale } = useLocale()
  const ja = t.jobAgent
  const [domains, setDomains] = useState(DEFAULT_PREFERENCES.domains.join(', '))
  const [remoteRequired, setRemoteRequired] = useState(true)
  const [minFit, setMinFit] = useState(55)
  const [exclude, setExclude] = useState('')
  const [excludeRoles, setExcludeRoles] = useState('')
  const [avoidSenior, setAvoidSenior] = useState(true)
  const [requireDomain, setRequireDomain] = useState(true)
  const [experienceLevel, setExperienceLevel] = useState<'junior' | 'mid' | 'senior' | 'any'>('mid')
  const [experienceYears, setExperienceYears] = useState('')
  const [targetCompanies, setTargetCompanies] = useState('')
  const [keywords, setKeywords] = useState('')
  const [rss, setRss] = useState('')
  const [nightlyEnabled, setNightlyEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nightlyRunning, setNightlyRunning] = useState(false)
  const [nightlyLog, setNightlyLog] = useState<string | null>(null)
  const [lastSummary, setLastSummary] = useState<{ scanned: number; created: number } | null>(null)
  const [runs, setRuns] = useState<RunRow[]>([])
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [gmailMode, setGmailMode] = useState<'env' | 'oauth' | null>(null)
  const [gmailRedirectUri, setGmailRedirectUri] = useState<string | null>(null)

  const load = useCallback(async () => {
    onWarning(null)
    const [prefRes, gmailRes] = await Promise.all([
      fetch('/api/modules/job-agent/preferences'),
      fetch('/api/modules/job-agent/gmail'),
    ])
    const data = await prefRes.json()
    const gmailData = await gmailRes.json()
    if (data.warning === 'job_agent_v2_missing') onWarning(ja.warnings.v2Missing)
    if (gmailData.warning === 'job_agent_v4_missing') onWarning(ja.warnings.v4Missing)
    setGmailConnected(Boolean(gmailData.connected))
    setGmailEmail(gmailData.email ?? null)
    setGmailMode(gmailData.mode ?? null)
    setGmailRedirectUri(gmailData.redirectUri ?? null)
    const p = { ...DEFAULT_PREFERENCES, ...(data.preferences ?? {}) }
    setDomains((p.domains ?? []).join(', '))
    setRemoteRequired(p.remoteRequired ?? true)
    setMinFit(p.minFitScore ?? 55)
    setExclude((p.excludeCompanies ?? []).join(', '))
    setExcludeRoles((p.excludeRoles ?? []).join(', '))
    setAvoidSenior(p.avoidSeniorTitles ?? true)
    setRequireDomain(p.requireCompanyDomainMatch ?? false)
    setExperienceLevel(p.experienceLevel ?? 'mid')
    setExperienceYears(p.experienceYears ? String(p.experienceYears) : '')
    setTargetCompanies((p.targetCompanies ?? []).join(', '))
    setKeywords((p.keywords ?? []).join(', '))
    setRss((p.rssFeeds ?? []).join(', '))
    setNightlyEnabled(p.nightlyEnabled ?? true)
    const runsRes = await fetch('/api/modules/job-agent/runs')
    const runsData = await runsRes.json()
    if (runsData.warning === 'job_agent_v2_missing') onWarning(ja.warnings.v2Missing)
    setRuns(runsData.items ?? [])
  }, [ja.warnings.v2Missing, ja.warnings.v4Missing, onWarning])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    setSaving(true)
    const rssFeeds = rss
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    await fetch('/api/modules/job-agent/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: {
          ...DEFAULT_PREFERENCES,
          domains: domains.split(',').map((s) => s.trim()).filter(Boolean),
          remoteRequired,
          minFitScore: minFit,
          excludeCompanies: exclude.split(',').map((s) => s.trim()).filter(Boolean),
          excludeRoles: excludeRoles.split(',').map((s) => s.trim()).filter(Boolean),
          avoidSeniorTitles: avoidSenior,
          requireCompanyDomainMatch: requireDomain,
          experienceLevel,
          experienceYears: experienceYears ? Number(experienceYears) : undefined,
          targetCompanies: targetCompanies.split(',').map((s) => s.trim()).filter(Boolean),
          keywords: keywords.split(',').map((s) => s.trim()).filter(Boolean),
          rssFeeds,
          nightlyEnabled,
        },
      }),
    })

    for (const feed of rssFeeds) {
      await fetch('/api/modules/job-agent/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'rss', value: feed, label: feed }),
      })
    }

    setSaving(false)
  }

  async function runNightly() {
    setNightlyRunning(true)
    setNightlyLog(null)
    setLastSummary(null)
    const res = await fetch('/api/modules/job-agent/nightly', { method: 'POST' })
    const data = await res.json()
    setNightlyRunning(false)
    if (data.log) {
      setNightlyLog(data.log.map((l: { message: string }) => l.message).join('\n'))
    }
    if (typeof data.jobsScanned === 'number' || typeof data.packsCreated === 'number') {
      setLastSummary({
        scanned: data.jobsScanned ?? 0,
        created: data.packsCreated ?? 0,
      })
    }
    if (data.warning) onWarning(ja.warnings.v3Missing)
    load()
  }

  const fieldClass =
    'mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm'

  return (
    <GlassPanel className="space-y-4 p-6">
      <p className="text-sm text-[var(--text-muted)]">{ja.preferences.hint}</p>

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/30 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--text)]">{ja.preferences.scheduleTitle}</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{ja.preferences.scheduleBody}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-[var(--text)]">{ja.preferences.stopTitle}</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{ja.preferences.stopBody}</p>
        </div>
        <p className="text-xs text-[var(--accent)]">{ja.preferences.lowResultsHint}</p>
      </div>

      <div className="rounded-xl border border-[var(--surface-border)] p-4">
        <h3 className="text-sm font-medium text-[var(--text)]">{ja.preferences.runsTitle}</h3>
        {runs.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">{ja.preferences.runsEmpty}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {runs.map((run) => (
              <li key={run.id} className="text-xs text-[var(--text-muted)]">
                {ja.preferences.runsRow
                  .replace('{scanned}', String(run.jobs_scanned))
                  .replace('{created}', String(run.packs_created))
                  .replace('{when}', formatWhen(run.started_at, locale))}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[var(--surface-border)] p-4">
        <h3 className="text-sm font-medium text-[var(--text)]">{ja.outreach.title}</h3>
        {gmailMode === 'env' ? (
          <p className="mt-1 text-xs text-[var(--accent)]">{ja.outreach.gmailEnvBackend}</p>
        ) : (
          <p className="mt-1 text-xs text-[var(--text-muted)]">{ja.outreach.gmailDisconnected}</p>
        )}
        {gmailConnected ? (
          <p className="mt-2 text-sm text-[var(--accent)]">
            {ja.outreach.sendingFrom}: {gmailEmail}
          </p>
        ) : null}
        {gmailRedirectUri && gmailMode !== 'env' && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {ja.outreach.gmailRedirectHint}{' '}
            <code className="text-[var(--accent)]">{gmailRedirectUri}</code>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {gmailMode !== 'env' && (
            <a
              href="/api/auth/gmail/connect"
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              {gmailConnected ? ja.outreach.reconnectGmail : ja.outreach.connectGmail}
            </a>
          )}
          {gmailConnected && gmailMode === 'oauth' && (
            <button
              type="button"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
              onClick={async () => {
                await fetch('/api/modules/job-agent/gmail', { method: 'DELETE' })
                load()
              }}
            >
              {t.common.delete}
            </button>
          )}
        </div>
      </div>

      <label className="block text-sm text-[var(--text)]">
        {ja.preferences.domains}
        <input value={domains} onChange={(e) => setDomains(e.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm text-[var(--text)]">
        {ja.preferences.exclude}
        <input value={exclude} onChange={(e) => setExclude(e.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm text-[var(--text)]">
        {ja.preferences.excludeRoles}
        <input value={excludeRoles} onChange={(e) => setExcludeRoles(e.target.value)} placeholder="senior, manager, director, vp" className={fieldClass} />
      </label>
      <label className="block text-sm text-[var(--text)]">
        {ja.preferences.targetCompanies}
        <input value={targetCompanies} onChange={(e) => setTargetCompanies(e.target.value)} placeholder="https://company.com/careers" className={fieldClass} />
      </label>
      <label className="block text-sm text-[var(--text)]">
        {ja.preferences.keywords}
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={fieldClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-[var(--text)]">
          {ja.preferences.experienceLevel}
          <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as 'junior' | 'mid' | 'senior' | 'any')} className={fieldClass}>
            <option value="junior">Junior</option>
            <option value="mid">Mid (not senior)</option>
            <option value="senior">Senior</option>
            <option value="any">Any</option>
          </select>
        </label>
        <label className="block text-sm text-[var(--text)]">
          {ja.preferences.experienceYears}
          <input type="number" min={0} max={40} value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className={fieldClass} />
        </label>
      </div>
      <label className="block text-sm text-[var(--text)]">
        {ja.preferences.minFit}
        <input
          type="number"
          min={0}
          max={100}
          value={minFit}
          onChange={(e) => setMinFit(Number(e.target.value))}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm text-[var(--text)]">
        {ja.preferences.rss}
        <input value={rss} onChange={(e) => setRss(e.target.value)} className={fieldClass} />
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input type="checkbox" checked={avoidSenior} onChange={(e) => setAvoidSenior(e.target.checked)} />
        {ja.preferences.avoidSenior}
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input type="checkbox" checked={requireDomain} onChange={(e) => setRequireDomain(e.target.checked)} />
        {ja.preferences.requireDomain}
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={remoteRequired}
          onChange={(e) => setRemoteRequired(e.target.checked)}
        />
        {ja.preferences.remoteRequired}
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={nightlyEnabled}
          onChange={(e) => setNightlyEnabled(e.target.checked)}
        />
        {ja.preferences.nightly}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? t.common.loading : ja.preferences.save}
        </Button>
        <Button variant="outline" onClick={runNightly} disabled={nightlyRunning}>
          {nightlyRunning ? ja.preferences.nightlyRunning : ja.preferences.runNightly}
        </Button>
      </div>
      {lastSummary && (
        <p className="text-sm text-[var(--accent)]">
          {ja.preferences.runSummary
            .replace('{scanned}', String(lastSummary.scanned))
            .replace('{created}', String(lastSummary.created))}
        </p>
      )}
      {nightlyLog && (
        <pre className="max-h-40 overflow-auto rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-3 text-xs text-[var(--text-muted)]">
          {nightlyLog}
        </pre>
      )}
    </GlassPanel>
  )
}
