'use client'

import { useCallback, useEffect, useState } from 'react'
import { GlassPanel } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import type { ApplicationPack } from './types'
import { PackDetailPanel } from './PackDetailPanel'

interface HistoryTabProps {
  onWarning: (msg: string | null) => void
}

export function HistoryTab({ onWarning }: HistoryTabProps) {
  const { t } = useLocale()
  const ja = t.jobAgent
  const [items, setItems] = useState<ApplicationPack[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = items.find((i) => i.id === selectedId) ?? null

  const load = useCallback(async () => {
    onWarning(null)
    const res = await fetch('/api/modules/job-agent/packs')
    const data = await res.json()
    if (data.warning === 'job_agent_v2_missing') onWarning(ja.warnings.v2Missing)
    const list = (data.items ?? []).filter(
      (i: ApplicationPack) => i.status !== 'pending_review',
    )
    setItems(list)
    setSelectedId(list[0]?.id ?? null)
  }, [ja.warnings.v2Missing, onWarning])

  useEffect(() => {
    load()
  }, [load])

  async function patchPack(
    id: string,
    patch: Partial<ApplicationPack> & { status?: string; funnel_stage?: string },
  ) {
    await fetch(`/api/modules/job-agent/packs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    load()
  }

  if (items.length === 0) {
    return (
      <GlassPanel className="p-6">
        <p className="text-sm text-[var(--text-muted)]">{ja.history.empty}</p>
      </GlassPanel>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <GlassPanel className="p-4 lg:col-span-1">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelectedId(item.id)}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--surface-border)] px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
              >
                <span className="text-[var(--text)]">
                  {item.company} · {item.role}
                </span>
                <span className="text-xs uppercase text-[var(--text-muted)]">
                  {item.funnel_stage !== 'none' ? item.funnel_stage : item.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </GlassPanel>
      {selected && (
        <GlassPanel className="p-6 lg:col-span-2">
          <PackDetailPanel pack={selected} onUpdate={(patch) => patchPack(selected.id, patch)} />
        </GlassPanel>
      )}
    </div>
  )
}
