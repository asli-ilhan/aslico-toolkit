'use client'

import { useEffect, useState } from 'react'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'

interface NewPackTabProps {
  onWarning: (msg: string | null) => void
  onDone: () => void
}

const FALLBACK_VARIANTS = [
  { id: 'default', label: 'Default' },
  { id: 'research', label: 'Research' },
  { id: 'industry', label: 'Industry' },
  { id: 'gig', label: 'Gig' },
]

export function NewPackTab({ onWarning, onDone }: NewPackTabProps) {
  const { t, locale } = useLocale()
  const ja = t.jobAgent
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [remoteType, setRemoteType] = useState('remote')
  const [employmentType, setEmploymentType] = useState('contract')
  const [jobDescription, setJobDescription] = useState('')
  const [profileVariant, setProfileVariant] = useState('default')
  const [variantOptions, setVariantOptions] = useState(FALLBACK_VARIANTS)
  const [deadlineAt, setDeadlineAt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/modules/job-agent/profile')
      const data = await res.json()
      const variants = data.profileVariants as Record<string, { label: string }> | null
      if (variants && Object.keys(variants).length > 0) {
        setVariantOptions(
          Object.entries(variants).map(([id, v]) => ({
            id,
            label: v.label || id,
          })),
        )
      }
    })()
  }, [])

  async function scrapeUrl() {
    if (!jobUrl.trim()) return
    setScraping(true)
    setError(null)
    const res = await fetch('/api/modules/job-agent/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: jobUrl }),
    })
    const data = await res.json()
    setScraping(false)
    if (!res.ok) {
      setError(data.error ?? ja.errors.generateFailed)
      return
    }
    if (data.company) setCompany(data.company)
    if (data.role) setRole(data.role)
    if (data.jobDescription) setJobDescription(data.jobDescription.slice(0, 20000))
  }

  async function handleSubmit() {
    setGenerating(true)
    setError(null)
    onWarning(null)

    const res = await fetch('/api/modules/job-agent/packs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company,
        role,
        jobUrl: jobUrl || undefined,
        remoteType,
        employmentType,
        jobDescription,
        profileVariant,
        deadlineAt: deadlineAt || undefined,
        locale,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      if (data.warning === 'job_agent_v2_missing') onWarning(ja.warnings.v2Missing)
      setError(data.error ?? ja.errors.generateFailed)
      setGenerating(false)
      return
    }

    setGenerating(false)
    onDone()
  }

  return (
    <GlassPanel className="space-y-3 p-6">
      <p className="text-sm text-[var(--text-muted)]">{ja.new.hint}</p>
      <div className="flex gap-2">
        <input
          value={jobUrl}
          onChange={(e) => setJobUrl(e.target.value)}
          placeholder={ja.new.jobUrl}
          className="flex-1 rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        <Button variant="outline" onClick={scrapeUrl} disabled={scraping}>
          {scraping ? ja.new.scraping : ja.new.scrape}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder={ja.company}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder={ja.role}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          value={remoteType}
          onChange={(e) => setRemoteType(e.target.value)}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm text-[var(--text)]"
        >
          <option value="remote">{ja.new.remote}</option>
          <option value="hybrid">{ja.new.hybrid}</option>
          <option value="onsite">{ja.new.onsite}</option>
        </select>
        <select
          value={employmentType}
          onChange={(e) => setEmploymentType(e.target.value)}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm text-[var(--text)]"
        >
          <option value="remote_ft">{ja.new.ft}</option>
          <option value="contract">{ja.new.contract}</option>
          <option value="freelance">{ja.new.freelance}</option>
          <option value="gig">{ja.new.gig}</option>
        </select>
        <select
          value={profileVariant}
          onChange={(e) => setProfileVariant(e.target.value)}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm text-[var(--text)]"
          aria-label={ja.new.variant}
        >
          {variantOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <label className="block text-sm text-[var(--text)]">
        {ja.new.deadline}
        <input
          type="date"
          value={deadlineAt}
          onChange={(e) => setDeadlineAt(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
        />
      </label>
      <textarea
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder={ja.jobDescription}
        rows={8}
        className="w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button className="w-full" disabled={generating} onClick={handleSubmit}>
        {generating ? ja.generating : ja.new.submit}
      </Button>
    </GlassPanel>
  )
}
