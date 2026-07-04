'use client'

import { useCallback, useEffect, useState } from 'react'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import type { ScoutModuleId } from '@/lib/scout/skipped'

export interface ScoutSkippedItem {
  id: string
  module_id: ScoutModuleId
  title: string
  subtitle: string | null
  item_url: string | null
  skip_reason: string
  skip_category: string
  fit_score: number | null
  created_at: string
}

interface ScoutSkippedPanelProps {
  moduleId: ScoutModuleId
  refreshKey?: number
  onPromoted?: () => void
}

export function ScoutSkippedPanel({ moduleId, refreshKey = 0, onPromoted }: ScoutSkippedPanelProps) {
  const { t } = useLocale()
  const ss = t.scoutSkipped
  const [items, setItems] = useState<ScoutSkippedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setWarning(null)
    const res = await fetch(`/api/modules/scout-skipped?module=${moduleId}`)
    const data = await res.json()
    if (data.warning === 'scout_skipped_table_missing') {
      setWarning(ss.warnings.tableMissing)
    }
    if (res.ok) setItems(data.items ?? [])
    setLoading(false)
  }, [moduleId, ss.warnings.tableMissing])

  useEffect(() => { load() }, [load, refreshKey])

  async function promote(id: string) {
    setBusyId(id)
    const res = await fetch(`/api/modules/scout-skipped/${id}`, { method: 'POST' })
    setBusyId(null)
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id))
      onPromoted?.()
    }
  }

  async function dismiss(id: string) {
    setBusyId(id)
    await fetch(`/api/modules/scout-skipped/${id}`, { method: 'DELETE' })
    setBusyId(null)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function categoryLabel(cat: string) {
    return ss.categories[cat as keyof typeof ss.categories] ?? cat
  }

  if (loading) {
    return <p className="text-xs text-[var(--text-muted)]">{t.common.loading}</p>
  }

  return (
    <GlassPanel className="space-y-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text)]">{ss.title}</h2>
        <p className="text-xs text-[var(--text-muted)]">{ss.hint}</p>
      </div>
      {warning && (
        <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-xs">{warning}</p>
      )}
      {items.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">{ss.empty}</p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-sm"
            >
              <div className="font-medium text-[var(--text)]">{item.subtitle ?? item.title}</div>
              <div className="text-xs text-[var(--text-muted)]">{item.title}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-[var(--background-alt)] px-1.5 py-0.5 text-[var(--text-muted)]">
                  {categoryLabel(item.skip_category)}
                </span>
                {item.fit_score != null && (
                  <span className="text-[var(--accent)]">{ss.fit}: {item.fit_score}%</span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{item.skip_reason}</p>
              {item.item_url && (
                <a
                  href={item.item_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-[var(--accent)] hover:underline"
                >
                  {ss.openLink}
                </a>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busyId === item.id}
                  onClick={() => promote(item.id)}
                >
                  {busyId === item.id ? t.common.loading : ss.generatePack}
                </Button>
                <Button
                  variant="outline"
                  disabled={busyId === item.id}
                  onClick={() => dismiss(item.id)}
                >
                  {ss.dismiss}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  )
}
