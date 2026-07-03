'use client'

import { useCallback, useEffect, useState } from 'react'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'

interface ProfileTabProps {
  onWarning: (msg: string | null) => void
}

export function ProfileTab({ onWarning }: ProfileTabProps) {
  const { t } = useLocale()
  const ja = t.jobAgent
  const [documents, setDocuments] = useState<{ id: string; filename: string; doc_type: string }[]>([])
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [variants, setVariants] = useState<Record<string, { label: string; summary: string }> | null>(null)
  const [filename, setFilename] = useState('cv.txt')
  const [docType, setDocType] = useState('cv')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    onWarning(null)
    const res = await fetch('/api/modules/job-agent/profile')
    const data = await res.json()
    if (data.warning === 'job_agent_v2_missing') onWarning(ja.warnings.v2Missing)
    setDocuments(data.documents ?? [])
    setProfile(data.profile)
    setVariants(data.profileVariants ?? null)
    setLoading(false)
  }, [ja.warnings.v2Missing, onWarning])

  useEffect(() => {
    void (async () => {
      await fetch('/api/modules/job-agent/documents/purge-test', { method: 'POST' })
      load()
    })()
  }, [load])

  async function deleteDocument(id: string) {
    await fetch(`/api/modules/job-agent/documents/${id}`, { method: 'DELETE' })
    load()
  }

  async function addDocument() {
    if (!content.trim()) return
    await fetch('/api/modules/job-agent/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, docType, content }),
    })
    setContent('')
    load()
  }

  async function buildProfile() {
    setBuilding(true)
    const res = await fetch('/api/modules/job-agent/profile', { method: 'POST' })
    const data = await res.json()
    setBuilding(false)
    if (res.ok) {
      setProfile(data.profile)
      setVariants(data.profileVariants ?? null)
    } else {
      onWarning(data.error ?? ja.errors.generateFailed)
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <GlassPanel className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-[var(--text)]">{ja.profile.upload}</h2>
        <p className="text-xs text-[var(--text-muted)]">{ja.profile.uploadHint}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="filename.txt"
            className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
          />
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
          >
            <option value="cv">CV</option>
            <option value="cover_letter">Cover letter</option>
            <option value="portfolio">Portfolio</option>
            <option value="other">Other</option>
          </select>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={ja.profile.paste}
          rows={8}
          className="w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
        />
        <Button onClick={addDocument}>{ja.profile.addDoc}</Button>

        {documents.length > 0 && (
          <ul className="mt-4 space-y-2 text-xs text-[var(--text-muted)]">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--surface-border)] px-2 py-1.5">
                <span>
                  {d.doc_type}: {d.filename}
                </span>
                <button
                  type="button"
                  onClick={() => deleteDocument(d.id)}
                  className="shrink-0 text-[var(--accent)] hover:underline"
                >
                  {t.common.delete}
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button variant="outline" className="w-full" disabled={building || documents.length === 0} onClick={buildProfile}>
          {building ? ja.profile.building : ja.profile.build}
        </Button>
      </GlassPanel>

      <GlassPanel className="p-5">
        <h2 className="text-sm font-semibold text-[var(--text)]">{ja.profile.master}</h2>
        {profile ? (
          <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-4 text-xs text-[var(--text-muted)]">
            {JSON.stringify(profile, null, 2)}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-muted)]">{ja.profile.empty}</p>
        )}
        {variants && Object.keys(variants).length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--text)]">{ja.profile.variants}</h3>
            <div className="mt-2 space-y-2">
              {Object.entries(variants).map(([key, v]) => (
                <div
                  key={key}
                  className="rounded-xl border border-[var(--surface-border)] bg-[var(--accent-soft)]/50 p-3 text-xs"
                >
                  <p className="font-medium text-[var(--accent)]">{v.label ?? key}</p>
                  <p className="mt-1 text-[var(--text-muted)]">{v.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
