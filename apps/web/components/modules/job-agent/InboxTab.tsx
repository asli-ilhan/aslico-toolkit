'use client'

import { useCallback, useEffect, useState } from 'react'
import { GlassPanel, Button, cn } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import type { ApplicationPack } from './types'
import { PackDetailPanel } from './PackDetailPanel'
import { DiscoveryPanel } from './DiscoveryPanel'
import { ScoutSkippedPanel } from '@/components/scout/ScoutSkippedPanel'
import { useDismissWithFeedback } from '@/lib/scout/use-dismiss-with-feedback'

interface InboxTabProps {
  onWarning: (msg: string | null) => void
}

export function InboxTab({ onWarning }: InboxTabProps) {
  const { t } = useLocale()
  const ja = t.jobAgent
  const [items, setItems] = useState<ApplicationPack[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [skippedRefresh, setSkippedRefresh] = useState(0)
  const { openDismiss, dialog: dismissDialog } = useDismissWithFeedback('job-agent')

  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null

  const load = useCallback(async () => {
    setLoading(true)
    onWarning(null)
    const res = await fetch('/api/modules/job-agent')
    const data = await res.json()
    if (data.warning === 'job_agent_v2_missing') onWarning(ja.warnings.v2Missing)
    if (res.ok) {
      setItems(data.items ?? [])
      if (data.items?.[0]) setSelectedId(data.items[0].id)
    }
    setLoading(false)
  }, [ja.warnings.v2Missing, onWarning])

  useEffect(() => {
    load()
  }, [load])

  async function patchPack(
    id: string,
    patch: Partial<ApplicationPack> & { status?: string; funnel_stage?: string },
  ) {
    const res = await fetch(`/api/modules/job-agent/packs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const data = await res.json()
      if (patch.status === 'approved' || patch.status === 'skipped' || patch.status === 'submitted') {
        setItems((prev) => prev.filter((i) => i.id !== id))
        setSelectedId(null)
      } else if (data.item) {
        setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)))
      }
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <GlassPanel className="space-y-4 p-8">
          <p className="text-center text-sm text-[var(--text-muted)]">{ja.inbox.empty}</p>
          <DiscoveryPanel
            onComplete={load}
            onWarning={onWarning}
            onRunFinished={() => setSkippedRefresh((n) => n + 1)}
          />
        </GlassPanel>
        <ScoutSkippedPanel
          moduleId="job-agent"
          refreshKey={skippedRefresh}
          onPromoted={load}
        />
        {dismissDialog}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <GlassPanel className="p-4">
        <DiscoveryPanel
          onComplete={load}
          onWarning={onWarning}
          compact
          onRunFinished={() => setSkippedRefresh((n) => n + 1)}
        />
      </GlassPanel>

      <ScoutSkippedPanel
        moduleId="job-agent"
        refreshKey={skippedRefresh}
        onPromoted={load}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassPanel className="p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold text-[var(--text)]">{ja.inbox.title}</h2>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2 text-left text-sm',
                    selected?.id === item.id
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--surface-border)] text-[var(--text-muted)]',
                  )}
                >
                  <p className="font-medium text-[var(--text)]">{item.company}</p>
                  <p className="text-xs">{item.role}</p>
                  {item.fit_score != null && (
                    <p className="mt-1 text-xs text-[var(--accent)]">
                      {ja.inbox.fit}: {Math.round(item.fit_score)}%
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </GlassPanel>

        {selected && (
          <GlassPanel className="p-6 lg:col-span-2">
            <PackDetailPanel
              pack={selected}
              editable
              onUpdate={(patch) => patchPack(selected.id, patch)}
              onRequestSkip={() => openDismiss({
                action: 'skip',
                title: selected.role,
                subtitle: selected.company,
                itemUrl: selected.job_url,
                onConfirm: () => patchPack(selected.id, { status: 'skipped' }),
              })}
            />
          </GlassPanel>
        )}
      </div>
      {dismissDialog}
    </div>
  )
}
